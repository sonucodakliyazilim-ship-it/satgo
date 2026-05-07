const { query } = require('../config/database');

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
  { parent_slug: 'elektronik', name: 'Telefon', slug: 'telefon', sort_order: 2 },
];

const makeSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ensureDefaultCategories = async () => {
  for (const category of DEFAULT_CATEGORIES) {
    await query(
      `INSERT INTO categories (name, slug, icon, sort_order, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         icon = EXCLUDED.icon,
         sort_order = EXCLUDED.sort_order`,
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
         sort_order = EXCLUDED.sort_order`,
      [category.parent_slug, category.name, category.slug, category.sort_order]
    );
  }
};

// GET /api/categories
const getCategories = async (req, res, next) => {
  try {
    await ensureDefaultCategories();

    const { rows } = await query(
      `SELECT c.*,
              COUNT(l.id) AS listing_count
       FROM categories c
       LEFT JOIN listings l ON l.category_id = c.id AND l.status = 'active'
       WHERE c.parent_id IS NULL AND c.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.sort_order`
    );

    // Fetch sub-categories for each
    const withSubs = await Promise.all(rows.map(async (cat) => {
      const subs = await query(
        `SELECT c.*, COUNT(l.id) AS listing_count
         FROM categories c
         LEFT JOIN listings l ON l.sub_category_id = c.id AND l.status = 'active'
         WHERE c.parent_id = $1 AND c.is_active = TRUE
         GROUP BY c.id ORDER BY c.sort_order`,
        [cat.id]
      );
      return { ...cat, sub_categories: subs.rows };
    }));

    res.json({ success: true, data: withSubs });
  } catch (err) { next(err); }
};

// GET /api/categories/:slug
const getCategory = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM categories WHERE slug = $1 AND is_active = TRUE',
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// POST /api/categories  (admin)
const createCategory = async (req, res, next) => {
  try {
    const { parent_id, name, slug, icon, description, sort_order } = req.body;
    const normalizedSlug = makeSlug(slug || name);
    if (!name || !normalizedSlug) {
      return res.status(422).json({ success: false, message: 'Kategori adi gerekli.' });
    }

    const { rows } = await query(
      `INSERT INTO categories (parent_id, name, slug, icon, description, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)
       ON CONFLICT (slug) DO UPDATE SET
         parent_id = EXCLUDED.parent_id,
         name = EXCLUDED.name,
         icon = EXCLUDED.icon,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order,
         is_active = TRUE
       RETURNING *`,
      [parent_id || null, name.trim(), normalizedSlug, icon || null, description || null, sort_order || 0]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// PATCH /api/categories/:id  (admin)
const updateCategory = async (req, res, next) => {
  try {
    const { parent_id, name, slug, icon, description, sort_order, is_active } = req.body;
    const hasParent = Object.prototype.hasOwnProperty.call(req.body, 'parent_id');
    const normalizedSlug = slug || name ? makeSlug(slug || name) : null;
    const { rows } = await query(
      `UPDATE categories SET
         parent_id   = CASE WHEN $1 THEN $2 ELSE parent_id END,
         name        = COALESCE($3, name),
         slug        = COALESCE($4, slug),
         icon        = COALESCE($5, icon),
         description = COALESCE($6, description),
         sort_order  = COALESCE($7, sort_order),
         is_active   = COALESCE($8, is_active)
       WHERE id = $9 RETURNING *`,
      [hasParent, parent_id || null, name, normalizedSlug, icon, description, sort_order, is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// DELETE /api/categories/:id (admin)
const deleteCategory = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE categories
       SET is_active = FALSE
       WHERE id = $1 OR parent_id = $1
       RETURNING *`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kategori bulunamadi.' });
    res.json({ success: true, message: 'Kategori silindi.', data: rows });
  } catch (err) { next(err); }
};

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
