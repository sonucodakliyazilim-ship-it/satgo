const { query, withTransaction } = require('../config/database');

const ensureTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      sub_category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      field_key VARCHAR(80) NOT NULL,
      label VARCHAR(160) NOT NULL,
      field_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text | number | select | boolean
      is_required BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT custom_fields_unique_scope UNIQUE (category_id, COALESCE(sub_category_id, 0), field_key)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS custom_field_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value VARCHAR(120) NOT NULL,
      label VARCHAR(160) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT custom_field_options_unique UNIQUE (field_id, value)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS listing_custom_fields (
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value_text TEXT,
      value_number DOUBLE PRECISION,
      value_bool BOOLEAN,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (listing_id, field_id)
    )
  `);
};

const getCustomFields = async (req, res, next) => {
  try {
    await ensureTables();
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const subCategoryId = req.query.sub_category_id ? Number(req.query.sub_category_id) : null;

    if (!categoryId) return res.status(422).json({ success: false, message: 'category_id gerekli.' });

    // Prefer sub_category scoped fields first, then category scoped.
    const { rows } = await query(
      `SELECT f.*,
              COALESCE(
                json_agg(
                  json_build_object('id', o.id, 'value', o.value, 'label', o.label, 'sort_order', o.sort_order)
                  ORDER BY o.sort_order, o.label
                ) FILTER (WHERE o.id IS NOT NULL),
                '[]'::json
              ) AS options
       FROM custom_fields f
       LEFT JOIN custom_field_options o ON o.field_id = f.id AND o.is_active = TRUE
       WHERE f.is_active = TRUE
         AND f.category_id = $1
         AND (
           ($2::int IS NOT NULL AND f.sub_category_id = $2)
           OR ($2::int IS NULL AND f.sub_category_id IS NULL)
           OR (f.sub_category_id IS NULL)
         )
       GROUP BY f.id
       ORDER BY f.sub_category_id NULLS LAST, f.sort_order, f.label`,
      [categoryId, subCategoryId],
    );

    // If sub_category_id provided, remove duplicate keys by keeping the most specific (sub_category scoped) one.
    const byKey = new Map();
    for (const row of rows) {
      const key = row.field_key;
      const existing = byKey.get(key);
      if (!existing) byKey.set(key, row);
      else if (existing.sub_category_id == null && row.sub_category_id != null) byKey.set(key, row);
    }
    res.json({ success: true, data: Array.from(byKey.values()) });
  } catch (err) {
    next(err);
  }
};

const adminList = async (req, res, next) => {
  try {
    await ensureTables();
    const { rows } = await query(
      `SELECT f.*,
              c.name AS category_name,
              sc.name AS sub_category_name
       FROM custom_fields f
       LEFT JOIN categories c ON c.id = f.category_id
       LEFT JOIN categories sc ON sc.id = f.sub_category_id
       ORDER BY f.updated_at DESC
       LIMIT 500`,
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

const adminUpsert = async (req, res, next) => {
  try {
    await ensureTables();
    const {
      id,
      category_id,
      sub_category_id,
      field_key,
      label,
      field_type = 'text',
      is_required = false,
      sort_order = 0,
      is_active = true,
      options = [],
    } = req.body || {};

    if (!category_id || !field_key || !label) {
      return res.status(422).json({ success: false, message: 'category_id, field_key ve label gerekli.' });
    }

    const cleanOptions = Array.isArray(options)
      ? options
          .map((o) => ({
            value: String(o?.value || '').trim(),
            label: String(o?.label || o?.value || '').trim(),
            sort_order: Number(o?.sort_order || 0),
            is_active: o?.is_active !== false,
          }))
          .filter((o) => o.value && o.label)
      : [];

    const saved = await withTransaction(async (client) => {
      const { rows } = await client.query(
        id
          ? `UPDATE custom_fields SET
               category_id = $1,
               sub_category_id = $2,
               field_key = $3,
               label = $4,
               field_type = $5,
               is_required = $6,
               sort_order = $7,
               is_active = $8,
               updated_at = NOW()
             WHERE id = $9
             RETURNING *`
          : `INSERT INTO custom_fields
               (category_id, sub_category_id, field_key, label, field_type, is_required, sort_order, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
        id
          ? [
              category_id,
              sub_category_id || null,
              String(field_key).trim(),
              String(label).trim(),
              String(field_type).trim(),
              !!is_required,
              Number(sort_order || 0),
              !!is_active,
              id,
            ]
          : [
              category_id,
              sub_category_id || null,
              String(field_key).trim(),
              String(label).trim(),
              String(field_type).trim(),
              !!is_required,
              Number(sort_order || 0),
              !!is_active,
            ],
      );
      const field = rows[0];

      // Replace options for select fields.
      if (field.field_type === 'select') {
        await client.query('UPDATE custom_field_options SET is_active = FALSE, updated_at = NOW() WHERE field_id = $1', [field.id]);
        for (const opt of cleanOptions) {
          await client.query(
            `INSERT INTO custom_field_options (field_id, value, label, sort_order, is_active)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (field_id, value) DO UPDATE SET
               label = EXCLUDED.label,
               sort_order = EXCLUDED.sort_order,
               is_active = EXCLUDED.is_active,
               updated_at = NOW()`,
            [field.id, opt.value, opt.label, opt.sort_order, opt.is_active],
          );
        }
      }

      const optRows = await client.query(
        `SELECT id, value, label, sort_order, is_active
         FROM custom_field_options
         WHERE field_id = $1 AND is_active = TRUE
         ORDER BY sort_order, label`,
        [field.id],
      );

      return { ...field, options: optRows.rows };
    });

    res.json({ success: true, message: 'Alan kaydedildi.', data: saved });
  } catch (err) {
    next(err);
  }
};

const adminDelete = async (req, res, next) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { rows } = await query(
      `UPDATE custom_fields SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Alan bulunamadı.' });
    res.json({ success: true, message: 'Alan silindi.', data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const upsertListingCustomFields = async (client, listingId, customFields = []) => {
  if (!Array.isArray(customFields) || !customFields.length) return;

  // Expect: [{ field_id, value }]
  for (const item of customFields) {
    const fieldId = String(item?.field_id || '').trim();
    if (!fieldId) continue;
    const value = item?.value;

    // Determine field type and place value in correct column
    const fieldRow = await client.query('SELECT field_type FROM custom_fields WHERE id = $1 AND is_active = TRUE', [fieldId]);
    if (!fieldRow.rows.length) continue;
    const type = fieldRow.rows[0].field_type;

    let valueText = null;
    let valueNumber = null;
    let valueBool = null;

    if (type === 'number') valueNumber = value === '' || value == null ? null : Number(value);
    else if (type === 'boolean') valueBool = value === true || value === 'true' || value === 1 || value === '1';
    else valueText = value == null ? null : String(value);

    await client.query(
      `INSERT INTO listing_custom_fields (listing_id, field_id, value_text, value_number, value_bool)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (listing_id, field_id) DO UPDATE SET
         value_text = EXCLUDED.value_text,
         value_number = EXCLUDED.value_number,
         value_bool = EXCLUDED.value_bool,
         updated_at = NOW()`,
      [listingId, fieldId, valueText, valueNumber, valueBool],
    );
  }
};

module.exports = {
  ensureTables,
  getCustomFields,
  adminList,
  adminUpsert,
  adminDelete,
  upsertListingCustomFields,
};

