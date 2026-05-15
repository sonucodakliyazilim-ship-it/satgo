const { query, withTransaction } = require('../config/database');
const { refreshExpiredPromotions } = require('../services/promotion.service');
const { ensureTables: ensureCustomFieldTables, upsertListingCustomFields } = require('./customField.controller');
const { insertListingImages } = require('./upload.controller');

// ── Helpers ───────────────────────────────────────────────────

const LISTINGS_PER_PAGE = 20;

const cleanStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
};

const getCategoryScopeIds = async (categoryId) => {
  const id = Number(categoryId);
  if (!Number.isFinite(id)) return [];
  const { rows } = await query(
    `WITH RECURSIVE category_scope AS (
       SELECT id FROM categories WHERE id = $1
       UNION ALL
       SELECT c.id
       FROM categories c
       JOIN category_scope parent ON parent.id = c.parent_id
     )
     SELECT id FROM category_scope`,
    [id],
  );
  return rows.map((row) => row.id);
};

const buildListingQuery = ({ category, city, district, minPrice, maxPrice, search,
  sortBy, status, userId, featured, urgent, showcase, preferredCity, preferredDistrict, page = 1, categoryIds }) => {

  const conditions = ["l.status = 'active'"];
  const params = [];
  const orderParams = [];
  let p = 1;

  if (userId)   { conditions.push(`l.user_id = $${p++}`);       params.push(userId); }
  if (status)   { conditions.push(`l.status = $${p++}::listing_status`); params.push(status); }
  if (Array.isArray(categoryIds) && categoryIds.length) {
    conditions.push(`(l.category_id = ANY($${p}::int[]) OR l.sub_category_id = ANY($${p}::int[]))`);
    params.push(categoryIds);
    p += 1;
  } else if (category) {
    conditions.push(`(l.category_id = $${p} OR l.sub_category_id = $${p++})`);
    params.push(category);
  }
  if (city)     { conditions.push(`l.city ILIKE $${p++}`);      params.push(`%${city}%`); }
  if (district) { conditions.push(`l.district ILIKE $${p++}`);  params.push(`%${district}%`); }
  if (minPrice) { conditions.push(`l.price >= $${p++}`);        params.push(minPrice); }
  if (maxPrice) { conditions.push(`l.price <= $${p++}`);        params.push(maxPrice); }
  if (featured) { conditions.push('l.is_featured = TRUE'); }
  if (urgent)   { conditions.push('l.is_urgent = TRUE'); }
  if (showcase) { conditions.push('l.is_showcase = TRUE'); }

  if (search) {
    conditions.push(`to_tsvector('turkish', l.title || ' ' || COALESCE(l.description,'')) @@ plainto_tsquery('turkish', $${p++})`);
    params.push(search);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const orderMap = {
    newest:   'l.created_at DESC',
    oldest:   'l.created_at ASC',
    cheapest: 'l.price ASC NULLS LAST',
    priciest: 'l.price DESC NULLS LAST',
    favorites: 'l.favorite_count DESC, l.created_at DESC',
    popular:  'l.view_count DESC',
    boosted:  'l.boosted_at DESC NULLS LAST, l.created_at DESC',
  };
  const baseOrder = orderMap[sortBy] || 'l.is_featured DESC, l.boosted_at DESC NULLS LAST, l.created_at DESC';
  let order = baseOrder;
  if (preferredCity && preferredDistrict) {
    order = `CASE
      WHEN l.city ILIKE $${params.length + 1} AND l.district ILIKE $${params.length + 2} THEN 0
      WHEN l.city ILIKE $${params.length + 1} THEN 1
      ELSE 2
    END, ${baseOrder}`;
    orderParams.push(`%${preferredCity}%`, `%${preferredDistrict}%`);
  } else if (preferredCity) {
    order = `CASE WHEN l.city ILIKE $${params.length + 1} THEN 0 ELSE 1 END, ${baseOrder}`;
    orderParams.push(`%${preferredCity}%`);
  }
  const offset = (page - 1) * LISTINGS_PER_PAGE;

  return { where, order, params, orderParams, offset };
};

const selectListingCards = async ({ where, order, params, orderParams = [], limit = LISTINGS_PER_PAGE, offset = 0 }) => {
  const p = params.length + orderParams.length + 1;
  const { rows } = await query(
    `SELECT l.*,
            c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
            u.name AS seller_name, NULL AS seller_avatar, u.rating_avg AS seller_rating,
            (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, sort_order ASC, created_at ASC LIMIT 1) AS primary_image
     FROM listings l
     JOIN categories c ON c.id = l.category_id
     JOIN users u ON u.id = l.user_id
     ${where}
     ORDER BY ${order}
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, ...orderParams, limit, offset],
  );
  return rows;
};

const HOME_SECTION_CONFIGS = [
  {
    key: 'popular',
    title: 'Popüler İkinci El İlanlar',
    subtitle: 'Satgo’da en çok incelenen fırsatlar',
    href: '/ilanlar?sortBy=popular',
    params: { sortBy: 'popular' },
  },
  {
    key: 'favorites',
    title: 'Favoriler',
    subtitle: 'En çok favoriye eklenen ilanlar',
    href: '/ilanlar?sortBy=favorites',
    params: { sortBy: 'favorites' },
  },
  {
    key: 'best-sellers',
    title: 'Çok Satanlar',
    subtitle: 'Hızlı karar verilen kategorilerden seçtiklerimiz',
    href: '/ilanlar?sortBy=boosted',
    params: { sortBy: 'boosted' },
    fallbackParams: { sortBy: 'newest' },
  },
  {
    key: 'weekly-stars',
    title: 'Haftanın Yıldızları',
    subtitle: 'Öne çıkan ve vitrindeki ilanlar',
    href: '/ilanlar?sortBy=boosted',
    params: { sortBy: 'boosted', featured: true },
    fallbackParams: { sortBy: 'newest' },
  },
];

// ── Controllers ───────────────────────────────────────────────

// GET /api/listings
const getListings = async (req, res, next) => {
  try {
    await refreshExpiredPromotions();
    const categoryIds = req.query.category ? await getCategoryScopeIds(req.query.category) : [];
    const { where, order, params, orderParams, offset } = buildListingQuery({ ...req.query, categoryIds });

    const countQ = await query(`SELECT COUNT(*) FROM listings l ${where}`, params);
    const total  = parseInt(countQ.rows[0].count);

    const listings = await selectListingCards({ where, order, params, orderParams, offset });

    res.json({
      success: true,
      data: {
        listings,
        pagination: {
          total,
          page:    parseInt(req.query.page) || 1,
          perPage: LISTINGS_PER_PAGE,
          pages:   Math.ceil(total / LISTINGS_PER_PAGE),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/listings/home-sections
const getHomeSections = async (req, res, next) => {
  try {
    await refreshExpiredPromotions();

    const sections = await Promise.all(
      HOME_SECTION_CONFIGS.map(async (section) => {
        const first = buildListingQuery({ ...section.params, page: 1 });
        let listings = await selectListingCards({ ...first, limit: 4 });

        if (!listings.length && section.fallbackParams) {
          const fallback = buildListingQuery({ ...section.fallbackParams, page: 1 });
          listings = await selectListingCards({ ...fallback, limit: 4 });
        }

        return { ...section, listings };
      }),
    );

    res.json({ success: true, data: sections });
  } catch (err) {
    next(err);
  }
};

// GET /api/listings/:id
const getListing = async (req, res, next) => {
  try {
    await refreshExpiredPromotions();
    const { id } = req.params;

    const { rows } = await query(
      `SELECT l.*,
              c.name  AS category_name, c.slug AS category_slug, c.icon AS category_icon,
              sc.name AS sub_category_name,
              u.name  AS seller_name, NULL AS seller_avatar,
              u.rating_avg AS seller_rating, u.rating_count AS seller_rating_count,
              u.listing_count AS seller_listing_count, u.city AS seller_city,
              u.phone AS seller_phone, u.created_at AS seller_member_since
       FROM listings l
       JOIN categories c ON c.id = l.category_id
       LEFT JOIN categories sc ON sc.id = l.sub_category_id
       JOIN users u ON u.id = l.user_id
       WHERE l.id = $1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
    }

    const listing = rows[0];

    // Fetch images
    const images = await query(
      'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY sort_order',
      [id]
    );
    listing.images = images.rows;

    // Fetch category-specific details
    if (listing.category_slug === 'arac') {
      const det = await query('SELECT * FROM vehicle_details WHERE listing_id = $1', [id]);
      listing.vehicle_details = det.rows[0] || null;
    } else if (listing.category_slug === 'motor') {
      const det = await query('SELECT * FROM motorcycle_details WHERE listing_id = $1', [id]);
      listing.motorcycle_details = det.rows[0] || null;
    } else if (listing.category_slug === 'emlak') {
      const det = await query('SELECT * FROM real_estate_details WHERE listing_id = $1', [id]);
      listing.real_estate_details = det.rows[0] || null;
    }

    await ensureCustomFieldTables();
    const customFieldRows = await query(
      `SELECT f.id,
              f.field_key,
              f.label,
              f.field_type,
              f.sort_order,
              lcf.value_text,
              lcf.value_number,
              lcf.value_bool,
              o.label AS option_label
       FROM listing_custom_fields lcf
       JOIN custom_fields f ON f.id = lcf.field_id
       LEFT JOIN custom_field_options o
         ON o.field_id = f.id
        AND o.value = lcf.value_text
        AND o.is_active = TRUE
       WHERE lcf.listing_id = $1
         AND f.is_active = TRUE
      ORDER BY f.sort_order, f.label`,
      [id],
    );

    for (const field of customFieldRows.rows) {
      if (field.field_type !== 'multi_select' || !field.value_text) continue;
      let selectedValues = [];
      try {
        const parsed = JSON.parse(field.value_text);
        selectedValues = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        selectedValues = String(field.value_text).split(',').map((item) => item.trim()).filter(Boolean);
      }
      if (!selectedValues.length) continue;

      const optionLabels = await query(
        `SELECT value, label
         FROM custom_field_options
         WHERE field_id = $1
           AND value = ANY($2::text[])
           AND is_active = TRUE`,
        [field.id, selectedValues],
      );
      const byValue = new Map(optionLabels.rows.map((option) => [option.value, option.label]));
      field.multi_option_label = selectedValues.map((value) => byValue.get(value) || value).join(', ');
    }

    listing.custom_fields = customFieldRows.rows.map((field) => ({
      id: field.id,
      field_key: field.field_key,
      label: field.label,
      field_type: field.field_type,
      value:
        field.field_type === 'number'
          ? field.value_number
          : field.field_type === 'checkbox' || field.field_type === 'boolean'
            ? field.value_bool
            : field.field_type === 'multi_select'
              ? field.multi_option_label || field.value_text
              : field.option_label || field.value_text,
    }));

    // Increment view count only for visitors, not the listing owner.
    if (!req.user || req.user.id !== listing.user_id) {
      query('UPDATE listings SET view_count = view_count + 1 WHERE id = $1', [id]).catch(() => {});
    }

    // Is favorited by current user?
    if (req.user) {
      const fav = await query(
        'SELECT id FROM favorites WHERE user_id = $1 AND listing_id = $2',
        [req.user.id, id]
      );
      listing.is_favorited = fav.rows.length > 0;
    }

    res.json({ success: true, data: listing });
  } catch (err) {
    next(err);
  }
};

// POST /api/listings
const createListing = async (req, res, next) => {
  try {
    const {
      category_id, sub_category_id, title, description, price, price_negotiable,
      condition, city, district, neighborhood, latitude, longitude,
      hierarchy_group, hierarchy_path, hierarchy_labels,
      vehicle_details, motorcycle_details, real_estate_details,
      custom_fields,
    } = req.body;

    const cleanHierarchyPath = cleanStringArray(hierarchy_path);
    const cleanHierarchyLabels = cleanStringArray(hierarchy_labels);
    const cleanHierarchyGroup = hierarchy_group ? String(hierarchy_group).trim() : null;
    const hasCustomFields = Array.isArray(custom_fields) && custom_fields.length > 0;
    let canSaveCustomFields = hasCustomFields;
    if (hasCustomFields) {
      try {
        await ensureCustomFieldTables();
      } catch (schemaErr) {
        canSaveCustomFields = false;
        console.warn('[listings] custom fields skipped:', schemaErr.message);
      }
    }

    const result = await withTransaction(async (client) => {
      // Create listing
      const { rows } = await client.query(
        `INSERT INTO listings
          (user_id, category_id, sub_category_id, title, description, price,
           price_negotiable, condition, city, district, neighborhood, latitude, longitude,
           hierarchy_group, hierarchy_path, hierarchy_labels, status, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'active',NOW())
         RETURNING *`,
        [
          req.user.id, category_id, sub_category_id || null,
          title, description || null, price || null,
          price_negotiable || false, condition || 'good',
          city || null, district || null, neighborhood || null,
          latitude || null, longitude || null,
          cleanHierarchyGroup, cleanHierarchyPath, cleanHierarchyLabels,
        ]
      );
      const listing = rows[0];

      // Category-specific details
      if (vehicle_details) {
        const v = vehicle_details;
        await client.query(
          `INSERT INTO vehicle_details
            (listing_id, brand, model, year, mileage, fuel_type, transmission,
             body_type, color, engine_cc, horse_power, doors, seats,
             has_damage_record, damage_detail, trade_in, plate_city, series, package_name, trim_name,
             drive_type, type_name, has_warranty, warranty_remaining, has_lpg, tramer_record,
             lien_pledge_status, plate_type, plate_number, chassis_last6, legal_brand, commercial_name, legal_model_year)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)`,
          [listing.id, v.brand, v.model, v.year, v.mileage, v.fuel_type,
           v.transmission, v.body_type, v.color, v.engine_cc, v.horse_power,
           v.doors, v.seats, v.has_damage_record || false,
           v.damage_detail || null, v.trade_in || false, v.plate_city || null,
           v.series || null, v.package_name || null, v.trim_name || null,
           v.drive_type || null, v.type_name || null, v.has_warranty || false,
           v.warranty_remaining || null, v.has_lpg || false, v.tramer_record || null,
           v.lien_pledge_status || null, v.plate_type || null, v.plate_number || null,
           v.chassis_last6 || null, v.legal_brand || null, v.commercial_name || null,
           v.legal_model_year || null]
        );
      }

      if (motorcycle_details) {
        const m = motorcycle_details;
        await client.query(
          `INSERT INTO motorcycle_details
            (listing_id, brand, model, year, mileage, engine_cc, license_class, color, condition_detail, trade_in, series, package_name, trim_name)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [listing.id, m.brand, m.model, m.year, m.mileage, m.engine_cc,
           m.license_class || null, m.color || null, m.condition_detail || null, m.trade_in || false,
           m.series || null, m.package_name || null, m.trim_name || null]
        );
      }

      if (real_estate_details) {
        const r = real_estate_details;
        await client.query(
          `INSERT INTO real_estate_details
            (listing_id, listing_type, size_m2, room_count, building_age, floor, total_floors,
             heating, is_furnished, has_balcony, has_parking, has_elevator, monthly_dues, deposit, deed_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [listing.id, r.listing_type || 'sale', r.size_m2, r.room_count,
           r.building_age, r.floor, r.total_floors, r.heating,
           r.is_furnished || false, r.has_balcony || false, r.has_parking || false,
           r.has_elevator || false, r.monthly_dues || null, r.deposit || null, r.deed_type || null]
        );
      }

      // Custom fields (category-dependent)
      if (canSaveCustomFields) {
        await upsertListingCustomFields(client, listing.id, custom_fields);
      }

      // Update user listing count
      await client.query(
        'UPDATE users SET listing_count = listing_count + 1 WHERE id = $1',
        [req.user.id]
      );

      return listing;
    });

    res.status(201).json({
      success: true,
      message: 'İlanınız yayına alındı.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const parseListingPayload = (body = {}) => {
  if (body.payload) {
    const parsed = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload;
    return parsed && typeof parsed === 'object' ? parsed : {};
  }
  return body;
};

const createListingWithImages = async (req, res, next) => {
  const originalBody = req.body;
  try {
    const payload = parseListingPayload(req.body);
    if (!req.files || req.files.length === 0) {
      return res.status(422).json({ success: false, message: 'Ilan yayinlamak icin en az 1 fotograf yukleyin.' });
    }

    let responseCode = 201;
    let responseBody = null;
    req.body = payload;

    await createListing(
      req,
      {
        status(code) {
          responseCode = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      },
      (err) => {
        if (err) throw err;
      },
    );

    req.body = originalBody;

    const listing = responseBody?.data;
    if (!responseBody?.success || !listing?.id) {
      return res.status(responseCode).json(responseBody || { success: false, message: 'Ilan olusturulamadi.' });
    }

    try {
      const images = await insertListingImages({ listingId: listing.id, files: req.files, user: req.user });
      return res.status(201).json({
        success: true,
        message: 'Ilan fotograflarla yayina alindi.',
        data: { ...listing, images, primary_image: images[0]?.url || null },
      });
    } catch (uploadErr) {
      await withTransaction(async (client) => {
        await client.query('DELETE FROM listings WHERE id = $1', [listing.id]);
        await client.query(
          'UPDATE users SET listing_count = GREATEST(listing_count - 1, 0) WHERE id = $1',
          [req.user.id],
        );
      }).catch(() => {});
      throw uploadErr;
    }
  } catch (err) {
    req.body = originalBody;
    next(err);
  }
};

// PATCH /api/listings/:id
const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, description, price, price_negotiable, condition,
      city, district, neighborhood,
      hierarchy_group, hierarchy_path, hierarchy_labels,
      vehicle_details, motorcycle_details, real_estate_details,
      custom_fields,
    } = req.body;

    const hasHierarchyPath = Object.prototype.hasOwnProperty.call(req.body, 'hierarchy_path');
    const hasHierarchyLabels = Object.prototype.hasOwnProperty.call(req.body, 'hierarchy_labels');
    const cleanHierarchyPath = cleanStringArray(hierarchy_path);
    const cleanHierarchyLabels = cleanStringArray(hierarchy_labels);
    const cleanHierarchyGroup = hierarchy_group === undefined ? undefined : String(hierarchy_group || '').trim() || null;
    await ensureCustomFieldTables();

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE listings SET
           title = COALESCE($1, title),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           price_negotiable = COALESCE($4, price_negotiable),
           condition = COALESCE($5, condition),
           city = COALESCE($6, city),
           district = COALESCE($7, district),
           neighborhood = COALESCE($8, neighborhood),
           hierarchy_group = COALESCE($9, hierarchy_group),
           hierarchy_path = CASE WHEN $10 THEN $11 ELSE hierarchy_path END,
           hierarchy_labels = CASE WHEN $12 THEN $13 ELSE hierarchy_labels END,
           updated_at = NOW()
         WHERE id = $14`,
        [
          title, description, price, price_negotiable, condition, city, district, neighborhood,
          cleanHierarchyGroup,
          hasHierarchyPath, cleanHierarchyPath,
          hasHierarchyLabels, cleanHierarchyLabels,
          id,
        ]
      );

      if (vehicle_details) {
        const v = vehicle_details;
        await client.query(
          `INSERT INTO vehicle_details
             (listing_id, brand, model, year, mileage, fuel_type, transmission, body_type, color, engine_cc,
              trade_in, series, package_name, trim_name, drive_type, type_name, has_warranty,
              warranty_remaining, has_lpg, has_damage_record, tramer_record, lien_pledge_status,
              plate_type, plate_number, chassis_last6, legal_brand, commercial_name, legal_model_year)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
           ON CONFLICT (listing_id) DO UPDATE SET
             brand=$2, model=$3, year=$4, mileage=$5, fuel_type=$6,
             transmission=$7, body_type=$8, color=$9, engine_cc=$10, trade_in=$11,
             series=$12, package_name=$13, trim_name=$14, drive_type=$15, type_name=$16,
             has_warranty=$17, warranty_remaining=$18, has_lpg=$19, has_damage_record=$20,
             tramer_record=$21, lien_pledge_status=$22, plate_type=$23, plate_number=$24,
             chassis_last6=$25, legal_brand=$26, commercial_name=$27, legal_model_year=$28`,
          [id, v.brand, v.model, v.year, v.mileage, v.fuel_type,
           v.transmission, v.body_type, v.color, v.engine_cc, v.trade_in || false,
           v.series || null, v.package_name || null, v.trim_name || null,
           v.drive_type || null, v.type_name || null, v.has_warranty || false,
           v.warranty_remaining || null, v.has_lpg || false, v.has_damage_record || false,
           v.tramer_record || null, v.lien_pledge_status || null, v.plate_type || null,
           v.plate_number || null, v.chassis_last6 || null, v.legal_brand || null,
           v.commercial_name || null, v.legal_model_year || null]
        );
      }

      if (motorcycle_details) {
        const m = motorcycle_details;
        await client.query(
          `INSERT INTO motorcycle_details
             (listing_id, brand, model, year, mileage, engine_cc, license_class, color, condition_detail, trade_in, series, package_name, trim_name)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (listing_id) DO UPDATE SET
             brand=$2, model=$3, year=$4, mileage=$5, engine_cc=$6,
             license_class=$7, color=$8, condition_detail=$9, trade_in=$10,
             series=$11, package_name=$12, trim_name=$13`,
          [id, m.brand, m.model, m.year, m.mileage, m.engine_cc,
           m.license_class || null, m.color || null, m.condition_detail || null,
           m.trade_in || false, m.series || null, m.package_name || null, m.trim_name || null]
        );
      }

      if (real_estate_details) {
        const r = real_estate_details;
        await client.query(
          `INSERT INTO real_estate_details
             (listing_id, listing_type, size_m2, room_count, building_age, floor, heating, is_furnished, monthly_dues)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (listing_id) DO UPDATE SET
             listing_type=$2, size_m2=$3, room_count=$4, building_age=$5,
             floor=$6, heating=$7, is_furnished=$8, monthly_dues=$9`,
          [id, r.listing_type, r.size_m2, r.room_count, r.building_age,
           r.floor, r.heating, r.is_furnished || false, r.monthly_dues || null]
        );
      }

      if (Array.isArray(custom_fields)) {
        await upsertListingCustomFields(client, id, custom_fields);
      }
    });

    const updated = await query('SELECT * FROM listings WHERE id = $1', [id]);
    res.json({ success: true, message: 'İlan güncellendi.', data: updated.rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/listings/:id
const deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT user_id FROM listings WHERE id = $1', [id]);
      if (!rows.length) throw Object.assign(new Error('İlan bulunamadı.'), { status: 404 });

      await client.query('DELETE FROM listings WHERE id = $1', [id]);
      await client.query(
        'UPDATE users SET listing_count = GREATEST(listing_count - 1, 0) WHERE id = $1',
        [rows[0].user_id]
      );
    });
    res.json({ success: true, message: 'İlan silindi.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/listings/me - listings owned by the authenticated user
const getMyListings = async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [req.user.id];
    const conds = ['l.user_id = $1'];

    if (status && status !== 'all') {
      params.push(status);
      conds.push(`l.status = $${params.length}::listing_status`);
    }

    const { rows } = await query(
      `SELECT l.*, c.name AS category_name, c.icon AS category_icon,
              (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, sort_order ASC, created_at ASC LIMIT 1) AS primary_image
       FROM listings l
       JOIN categories c ON c.id = l.category_id
       WHERE ${conds.join(' AND ')}
       ORDER BY
         CASE l.status
           WHEN 'pending' THEN 1
           WHEN 'active' THEN 2
           WHEN 'passive' THEN 3
           WHEN 'sold' THEN 4
           ELSE 5
         END,
         l.created_at DESC
       LIMIT 100`,
      params,
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/listings/:id/status - owner can hide, mark sold, or reactivate already-approved listings
const setListingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['active', 'passive', 'sold'];

    if (!allowed.includes(status)) {
      return res.status(422).json({ success: false, message: 'Geçerli bir ilan durumu seçin.' });
    }

    const current = await query(
      'SELECT id, user_id, status, approved_at FROM listings WHERE id = $1',
      [id],
    );
    if (!current.rows.length) {
      return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
    }

    const listing = current.rows[0];
    if (listing.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
    }

    if (status === 'active' && !listing.approved_at && req.user.role !== 'admin') {
      return res.status(409).json({ success: false, message: 'Admin onayı olmayan ilan yayına alınamaz.' });
    }

    const { rows } = await query(
      `UPDATE listings
       SET status = $1::listing_status, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id],
    );

    res.json({ success: true, message: 'İlan durumu güncellendi.', data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/listings/user/:userId  — listings by a user
const getUserListings = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status = 'active', page = 1 } = req.query;
    const offset = (page - 1) * LISTINGS_PER_PAGE;

    const { rows } = await query(
      `SELECT l.*, c.name AS category_name, c.icon AS category_icon,
              (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, sort_order ASC, created_at ASC LIMIT 1) AS primary_image
       FROM listings l JOIN categories c ON c.id = l.category_id
       WHERE l.user_id = $1 AND l.status = $2
       ORDER BY l.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, status, LISTINGS_PER_PAGE, offset]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getListings,
  getHomeSections,
  getListing,
  createListing,
  createListingWithImages,
  updateListing,
  deleteListing,
  getMyListings,
  setListingStatus,
  getUserListings,
};
