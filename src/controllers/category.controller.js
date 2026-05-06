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

const ensureDefaultCategories = async () => {
  for (const category of DEFAULT_CATEGORIES) {
    await query(
      `INSERT INTO categories (name, slug, icon, sort_order, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         icon = EXCLUDED.icon,
         sort_order = EXCLUDED.sort_order,
         is_active = TRUE`,
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
         is_active = TRUE`,
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
    const { rows } = await query(
      `INSERT INTO categories (parent_id, name, slug, icon, description, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [parent_id || null, name, slug, icon || null, description || null, sort_order || 0]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// PATCH /api/categories/:id  (admin)
const updateCategory = async (req, res, next) => {
  try {
    const { name, icon, description, sort_order, is_active } = req.body;
    const { rows } = await query(
      `UPDATE categories SET
         name        = COALESCE($1, name),
         icon        = COALESCE($2, icon),
         description = COALESCE($3, description),
         sort_order  = COALESCE($4, sort_order),
         is_active   = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [name, icon, description, sort_order, is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

module.exports = { getCategories, getCategory, createCategory, updateCategory };
