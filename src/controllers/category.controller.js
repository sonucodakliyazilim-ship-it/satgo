const { query } = require('../config/database');
const multer = require('multer');

const DEFAULT_CATEGORIES = [
  { name: 'Araç', slug: 'arac', icon: '🚗', sort_order: 1 },
  { name: 'Motor', slug: 'motor', icon: '🏍', sort_order: 2 },
  { name: 'Emlak', slug: 'emlak', icon: '🏠', sort_order: 3 },
  { name: 'Elektronik', slug: 'elektronik', icon: '📱', sort_order: 4 },
  { name: 'Ev Eşyası', slug: 'ev-esyasi', icon: '🛋', sort_order: 5 },
  { name: 'Giyim', slug: 'giyim', icon: '👕', sort_order: 6 },
  { name: 'Hizmet', slug: 'hizmet', icon: '🔧', sort_order: 7 },
  { name: 'İş İlanları', slug: 'is-ilanlari', icon: '💼', sort_order: 8 },
  { name: 'Spor', slug: 'spor', icon: '⚽', sort_order: 9 },
  { name: 'Diğer', slug: 'diger', icon: '📦', sort_order: 10 },
  { name: 'Telefon', slug: 'telefon', icon: '📱', sort_order: 11 },
  { name: 'Kişisel Bakım & Kozmetik', slug: 'kisisel-bakim-kozmetik', icon: '✨', sort_order: 12 },
  { name: 'Anne & Bebek & Oyuncak', slug: 'anne-bebek-oyuncak', icon: '🧸', sort_order: 13 },
  { name: 'Hobi & Kitap & Müzik', slug: 'hobi-kitap-muzik', icon: '🎸', sort_order: 14 },
  { name: 'Ofis & Kırtasiye', slug: 'ofis-kirtasiye', icon: '🗂', sort_order: 15 },
  { name: 'Spor & Outdoor', slug: 'spor-outdoor', icon: '🏕', sort_order: 16 },
  { name: 'Diğer Araçlar', slug: 'diger-araclar', icon: '🚚', sort_order: 17 },
  { name: 'Antika', slug: 'antika', icon: '🏺', sort_order: 18 },
  { name: 'Pet Shop', slug: 'pet-shop', icon: '🐾', sort_order: 19 },
];

const DEFAULT_SUB_CATEGORIES = [
  { parent_slug: 'arac', name: 'Otomobil', slug: 'otomobil', sort_order: 1 },
  { parent_slug: 'arac', name: 'SUV & 4x4', slug: 'suv', sort_order: 2 },
  { parent_slug: 'arac', name: 'Ticari Araç', slug: 'ticari-arac', sort_order: 3 },
  { parent_slug: 'arac', name: 'Klasik', slug: 'klasik', sort_order: 4 },
  { parent_slug: 'emlak', name: 'Konut', slug: 'konut', sort_order: 1 },
  { parent_slug: 'emlak', name: 'İş Yeri', slug: 'is-yeri', sort_order: 2 },
  { parent_slug: 'emlak', name: 'Arsa & Tarla', slug: 'arsa', sort_order: 3 },
  { parent_slug: 'emlak', name: 'Devren Kiralık', slug: 'devren-kiralik', sort_order: 4 },
  { parent_slug: 'motor', name: 'Motosiklet', slug: 'motosiklet', sort_order: 1 },
  { parent_slug: 'motor', name: 'Ekipman', slug: 'motor-ekipman', sort_order: 2 },
  { parent_slug: 'elektronik', name: 'Bilgisayar', slug: 'bilgisayar', sort_order: 1 },
  { parent_slug: 'elektronik', name: 'Telefon', slug: 'elektronik-telefon', sort_order: 2 },
  { parent_slug: 'telefon', name: 'iPhone iOS Telefon', slug: 'iphone-ios-telefon', sort_order: 1 },
  { parent_slug: 'telefon', name: 'Android Telefon', slug: 'android-telefon', sort_order: 2 },
  { parent_slug: 'telefon', name: 'Telefon Aksesuarları', slug: 'telefon-aksesuarlari', sort_order: 3 },
  { parent_slug: 'telefon', name: 'Telefon Yedek Parçaları', slug: 'telefon-yedek-parcalari', sort_order: 4 },
  { parent_slug: 'kisisel-bakim-kozmetik', name: 'Kozmetik', slug: 'kozmetik', sort_order: 1 },
  { parent_slug: 'kisisel-bakim-kozmetik', name: 'Kişisel Bakım', slug: 'kisisel-bakim', sort_order: 2 },
  { parent_slug: 'anne-bebek-oyuncak', name: 'Bebek', slug: 'bebek', sort_order: 1 },
  { parent_slug: 'anne-bebek-oyuncak', name: 'Oyuncak', slug: 'oyuncak', sort_order: 2 },
  { parent_slug: 'hobi-kitap-muzik', name: 'Kitap', slug: 'kitap', sort_order: 1 },
  { parent_slug: 'hobi-kitap-muzik', name: 'Müzik', slug: 'muzik', sort_order: 2 },
  { parent_slug: 'ofis-kirtasiye', name: 'Ofis', slug: 'ofis', sort_order: 1 },
  { parent_slug: 'ofis-kirtasiye', name: 'Kırtasiye', slug: 'kirtasiye', sort_order: 2 },
  { parent_slug: 'spor-outdoor', name: 'Spor', slug: 'spor-urunleri', sort_order: 1 },
  { parent_slug: 'spor-outdoor', name: 'Outdoor', slug: 'outdoor', sort_order: 2 },
  { parent_slug: 'diger-araclar', name: 'Karavan', slug: 'karavan', sort_order: 1 },
  { parent_slug: 'diger-araclar', name: 'Tekne', slug: 'tekne', sort_order: 2 },
  { parent_slug: 'diger-araclar', name: 'Tarım Aracı', slug: 'tarim-araci', sort_order: 3 },
  { parent_slug: 'antika', name: 'Antika', slug: 'antika-urunler', sort_order: 1 },
  { parent_slug: 'antika', name: 'Koleksiyon', slug: 'koleksiyon', sort_order: 2 },
  { parent_slug: 'pet-shop', name: 'Pet Ürünleri', slug: 'pet-urunleri', sort_order: 1 },
  { parent_slug: 'pet-shop', name: 'Kedi Ürünleri', slug: 'kedi-urunleri', sort_order: 2 },
  { parent_slug: 'pet-shop', name: 'Köpek Ürünleri', slug: 'kopek-urunleri', sort_order: 3 },
];

const makeSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const preventCategoryCache = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

let categorySchemaPromise = null;
const ensureCategorySchema = () => {
  if (!categorySchemaPromise) {
    categorySchemaPromise = query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ')
      .catch((err) => {
        categorySchemaPromise = null;
        throw err;
      });
  }
  return categorySchemaPromise;
};

const parseCsvLine = (line) => {
  const result = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      result.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  result.push(value.trim());
  return result;
};

const upsertCategory = async ({ parentId = null, name, slug, icon = null, sortOrder = 0 }) => {
  await ensureCategorySchema();
  const cleanName = String(name || '').trim();
  const normalizedSlug = makeSlug(slug || cleanName);
  if (!cleanName || !normalizedSlug) return null;

  const { rows } = await query(
    `INSERT INTO categories (parent_id, name, slug, icon, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,TRUE)
     ON CONFLICT (slug) DO UPDATE SET
       parent_id = EXCLUDED.parent_id,
       name = EXCLUDED.name,
       icon = COALESCE(EXCLUDED.icon, categories.icon),
       sort_order = EXCLUDED.sort_order,
       is_active = TRUE,
       deleted_at = NULL
     RETURNING *`,
    [parentId, cleanName, normalizedSlug, icon || null, Number(sortOrder || 0)],
  );
  return rows[0];
};

const parseCategoryCsv = (csv) => {
  const lines = String(csv || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const first = parseCsvLine(lines[0]).map((item) => makeSlug(item));
  const hasHeader = first.some((item) => ['path', 'kategori', 'ana-kategori', 'parent', 'name', 'slug'].includes(item));
  const header = hasHeader ? first : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const columns = parseCsvLine(line);
      if (header.includes('path')) {
        return { path: String(columns[header.indexOf('path')] || '').split('>').map((item) => item.trim()).filter(Boolean) };
      }

      if (header.length) {
        const parent = columns[header.findIndex((item) => ['ana-kategori', 'parent', 'kategori'].includes(item))] || '';
        const name = columns[header.findIndex((item) => ['alt-kategori', 'name', 'ad'].includes(item))] || columns[0] || '';
        const slug = header.includes('slug') ? columns[header.indexOf('slug')] : '';
        const icon = header.includes('icon') ? columns[header.indexOf('icon')] : '';
        const sortOrder = header.includes('sort-order') ? columns[header.indexOf('sort-order')] : 0;
        return parent ? { path: [parent, name], slug, icon, sortOrder } : { path: [name], slug, icon, sortOrder };
      }

      if (columns.length === 1) return { path: columns[0].split('>').map((item) => item.trim()).filter(Boolean) };
      return { path: columns.filter(Boolean) };
    })
    .filter((row) => row.path?.length);
};

let defaultCategoriesReady = false;

const ensureDefaultCategories = async () => {
  if (defaultCategoriesReady) return;
  await ensureCategorySchema();

  for (const category of DEFAULT_CATEGORIES) {
    await query(
      `INSERT INTO categories (name, slug, icon, sort_order, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (slug) DO UPDATE SET
         parent_id = NULL,
         name = EXCLUDED.name,
         icon = EXCLUDED.icon,
         sort_order = EXCLUDED.sort_order,
         deleted_at = NULL`,
      [category.name, category.slug, category.icon, category.sort_order]
    );
  }

  for (const category of DEFAULT_SUB_CATEGORIES) {
    await query(
      `INSERT INTO categories (parent_id, name, slug, sort_order, is_active)
       SELECT parent.id, $2, $3, $4, TRUE
       FROM categories parent
       WHERE parent.slug = $1
       ON CONFLICT (slug) DO UPDATE SET
         parent_id = EXCLUDED.parent_id,
         name = EXCLUDED.name,
         sort_order = EXCLUDED.sort_order,
         deleted_at = NULL`,
      [category.parent_slug, category.name, category.slug, category.sort_order]
    );
  }

  defaultCategoriesReady = true;
};

// GET /api/categories
const getCategories = async (req, res, next) => {
  try {
    preventCategoryCache(res);
    await ensureCategorySchema();
    await ensureDefaultCategories();
    const startTime = Date.now();
    const includeInactive = req.query.include_inactive === 'true' || req.query.includeInactive === 'true';

    // Fast: count active listings by category in JS instead of CTE
    const { rows: allCategories } = await query(
      `SELECT id, parent_id, name, slug, icon, sort_order, is_active
       FROM categories
       WHERE deleted_at IS NULL
         AND ($1::boolean = TRUE OR is_active = TRUE)
       ORDER BY parent_id NULLS FIRST, sort_order ASC, name ASC`,
      [includeInactive],
    );

    // Count active listings per category
    const { rows: listingCounts } = await query(
      `SELECT category_id, COUNT(*)::int AS count
       FROM listings WHERE status = 'active' AND category_id IS NOT NULL
       GROUP BY category_id`
    );
    const countMap = new Map(listingCounts.map(r => [r.category_id, r.count]));
    const categoriesMap = new Map(allCategories.map((category) => [category.id, { ...category, count: countMap.get(category.id) || 0, sub_categories: [] }]));
    const roots = [];
    for (const category of categoriesMap.values()) {
      if (category.parent_id) {
        const parent = categoriesMap.get(category.parent_id);
        if (parent) parent.sub_categories.push(category);
      } else {
        roots.push(category);
      }
    }
    const sortTree = (nodeList) => {
      nodeList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      nodeList.forEach((node) => sortTree(node.sub_categories));
    };
    sortTree(roots);
    console.log(`[getCategories] query ${Date.now() - startTime}ms, categories ${allCategories.length}`);

    res.json({ success: true, data: roots });
  } catch (err) { next(err); }
};

// GET /api/categories/:slug
const getCategory = async (req, res, next) => {
  try {
    await ensureCategorySchema();
    const { rows } = await query(
      'SELECT * FROM categories WHERE slug = $1 AND is_active = TRUE AND deleted_at IS NULL',
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// POST /api/categories  (admin)
const createCategory = async (req, res, next) => {
  try {
    await ensureCategorySchema();
    const { parent_id, name, slug, icon, sort_order, is_active } = req.body;
    const normalizedSlug = makeSlug(slug || name);
    if (!name || !normalizedSlug) {
      return res.status(422).json({ success: false, message: 'Kategori adi gerekli.' });
    }

    const { rows } = await query(
      `INSERT INTO categories (parent_id, name, slug, icon, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO UPDATE SET
         parent_id = EXCLUDED.parent_id,
         name = EXCLUDED.name,
         icon = EXCLUDED.icon,
         sort_order = EXCLUDED.sort_order,
         is_active = EXCLUDED.is_active,
         deleted_at = NULL
       RETURNING *`,
      [parent_id || null, name.trim(), normalizedSlug, icon || null, sort_order || 0, is_active !== false]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// PATCH /api/categories/:id  (admin)
const updateCategory = async (req, res, next) => {
  try {
    await ensureCategorySchema();
    const { parent_id, name, slug, icon, sort_order, is_active } = req.body;
    const hasParent = Object.prototype.hasOwnProperty.call(req.body, 'parent_id');
    const normalizedSlug = slug || name ? makeSlug(slug || name) : null;

    if (hasParent) {
      const parentId = parent_id || null;
      if (parentId && String(parentId) === String(req.params.id)) {
        return res.status(422).json({ success: false, message: 'Kategori kendisinin altına taşınamaz.' });
      }

      if (parentId) {
        const branch = await query(
          `WITH RECURSIVE branch AS (
             SELECT id FROM categories WHERE id = $1
             UNION ALL
             SELECT child.id
             FROM categories child
             JOIN branch parent ON child.parent_id = parent.id
           )
           SELECT 1 FROM branch WHERE id = $2 LIMIT 1`,
          [req.params.id, parentId],
        );
        if (branch.rows.length) {
          return res.status(422).json({ success: false, message: 'Kategori kendi alt kategorisinin içine taşınamaz.' });
        }
      }
    }

    const { rows } = await query(
      `UPDATE categories SET
         parent_id   = CASE WHEN $1 THEN $2 ELSE parent_id END,
         name        = COALESCE($3, name),
         slug        = COALESCE($4, slug),
         icon        = COALESCE($5, icon),
         sort_order  = COALESCE($6, sort_order),
         is_active   = COALESCE($7, is_active),
         deleted_at  = NULL
       WHERE id = $8 RETURNING *`,
      [hasParent, parent_id || null, name, normalizedSlug, icon, sort_order, is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// DELETE /api/categories/:id (admin)
const deleteCategory = async (req, res, next) => {
  try {
    await ensureCategorySchema();
    const { rows } = await query(
      `WITH RECURSIVE branch AS (
         SELECT id FROM categories WHERE id = $1
         UNION ALL
         SELECT child.id
         FROM categories child
         JOIN branch parent ON child.parent_id = parent.id
       )
       UPDATE categories
       SET is_active = FALSE,
           deleted_at = NOW()
       WHERE id IN (SELECT id FROM branch)
       RETURNING id, name, slug`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kategori bulunamadi.' });
    res.json({
      success: true,
      message: 'Kategori silindi.',
      data: { deleted_ids: rows.map((row) => row.id), categories: rows },
    });
  } catch (err) { next(err); }
};

const importCsv = async (req, res, next) => {
  try {
    const csv = req.file ? req.file.buffer.toString('utf8') : req.body.csv;
    const rows = parseCategoryCsv(csv);
    if (!rows.length) {
      return res.status(422).json({ success: false, message: 'CSV içinde aktarılacak kategori bulunamadı.' });
    }

    let imported = 0;
    for (const [rowIndex, row] of rows.entries()) {
      let parentId = null;
      for (const [pathIndex, label] of row.path.entries()) {
        const node = await upsertCategory({
          parentId,
          name: label,
          slug: pathIndex === row.path.length - 1 ? row.slug : undefined,
          icon: pathIndex === 0 ? row.icon : null,
          sortOrder: row.sortOrder || rowIndex * 10 + pathIndex,
        });
        if (!node) continue;
        parentId = node.id;
        imported += 1;
      }
    }

    res.json({ success: true, message: 'Kategori CSV aktarıldı.', data: { rows: rows.length, imported } });
  } catch (err) { next(err); }
};

module.exports = {
  uploadCsv,
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  importCsv,
};
