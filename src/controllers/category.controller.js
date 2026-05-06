const { query } = require('../config/database');

// GET /api/categories
const getCategories = async (req, res, next) => {
  try {
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
