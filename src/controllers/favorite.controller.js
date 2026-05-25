const { query } = require('../config/database');

let listingRuntimeSchemaPromise = null;
const ensureListingRuntimeSchema = () => {
  if (!listingRuntimeSchemaPromise) {
    listingRuntimeSchemaPromise = query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ')
      .catch((err) => {
        listingRuntimeSchemaPromise = null;
        throw err;
      });
  }
  return listingRuntimeSchemaPromise;
};

// GET /api/favorites
const getFavorites = async (req, res, next) => {
  try {
    await ensureListingRuntimeSchema();
    const { rows } = await query(
      `SELECT l.*, f.created_at AS favorited_at,
              c.name AS category_name, c.icon AS category_icon,
              u.name AS seller_name,
              (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, sort_order ASC, created_at ASC LIMIT 1) AS primary_image
       FROM favorites f
       JOIN listings l ON l.id = f.listing_id
       JOIN categories c ON c.id = l.category_id
       JOIN users u ON u.id = l.user_id
       WHERE f.user_id = $1
         AND l.deleted_at IS NULL
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// POST /api/favorites/:listingId
const addFavorite = async (req, res, next) => {
  try {
    await ensureListingRuntimeSchema();
    const { listingId } = req.params;
    const listing = await query('SELECT id FROM listings WHERE id = $1 AND deleted_at IS NULL', [listingId]);
    if (!listing.rows.length) return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });

    await query(
      'INSERT INTO favorites (user_id, listing_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, listingId]
    );
    res.json({ success: true, message: 'Favorilere eklendi.' });
  } catch (err) { next(err); }
};

// DELETE /api/favorites/:listingId
const removeFavorite = async (req, res, next) => {
  try {
    await query(
      'DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2',
      [req.user.id, req.params.listingId]
    );
    res.json({ success: true, message: 'Favorilerden çıkarıldı.' });
  } catch (err) { next(err); }
};

// GET /api/favorites/check/:listingId
const checkFavorite = async (req, res, next) => {
  try {
    await ensureListingRuntimeSchema();
    const { rows } = await query(
      `SELECT f.id
       FROM favorites f
       JOIN listings l ON l.id = f.listing_id
       WHERE f.user_id = $1
         AND f.listing_id = $2
         AND l.deleted_at IS NULL`,
      [req.user.id, req.params.listingId]
    );
    res.json({ success: true, data: { is_favorited: rows.length > 0 } });
  } catch (err) { next(err); }
};

module.exports = { getFavorites, addFavorite, removeFavorite, checkFavorite };
