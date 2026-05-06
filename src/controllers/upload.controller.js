const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

// ── Multer config ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadRoot = path.isAbsolute(process.env.UPLOAD_DIR || '')
      ? process.env.UPLOAD_DIR
      : path.join(__dirname, '../..', process.env.UPLOAD_DIR || 'uploads');
    const dir = path.join(uploadRoot, 'listings');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Sadece JPG, PNG ve WEBP dosyaları kabul edilir.'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    files:    parseInt(process.env.MAX_FILES_PER_LISTING) || 10,
  },
});

// ── Controller ─────────────────────────────────────────────────

// POST /api/upload/listing-images/:listingId
const uploadListingImages = async (req, res, next) => {
  try {
    const { listingId } = req.params;

    // Verify ownership
    const listing = await query('SELECT user_id FROM listings WHERE id = $1', [listingId]);
    if (!listing.rows.length) return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
    if (listing.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Dosya seçilmedi.' });
    }

    // Check existing image count
    const existing = await query('SELECT COUNT(*) FROM listing_images WHERE listing_id = $1', [listingId]);
    const max = parseInt(process.env.MAX_FILES_PER_LISTING) || 10;
    if (parseInt(existing.rows[0].count) + req.files.length > max) {
      return res.status(400).json({ success: false, message: `En fazla ${max} fotoğraf yükleyebilirsiniz.` });
    }

    const isPrimaryExisting = await query(
      'SELECT id FROM listing_images WHERE listing_id = $1 AND is_primary = TRUE',
      [listingId]
    );
    const hasPrimary = isPrimaryExisting.rows.length > 0;

    const inserted = await Promise.all(req.files.map(async (file, idx) => {
      const url       = `/uploads/listings/${file.filename}`;
      const isPrimary = !hasPrimary && idx === 0;
      const { rows } = await query(
        `INSERT INTO listing_images (listing_id, url, sort_order, is_primary)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [listingId, url, parseInt(existing.rows[0].count) + idx, isPrimary]
      );
      return rows[0];
    }));

    res.json({ success: true, message: `${inserted.length} fotoğraf yüklendi.`, data: inserted });
  } catch (err) { next(err); }
};

// DELETE /api/upload/listing-images/:imageId
const deleteListingImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const { rows } = await query(
      `SELECT li.*, l.user_id FROM listing_images li
       JOIN listings l ON l.id = li.listing_id
       WHERE li.id = $1`,
      [imageId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Fotoğraf bulunamadı.' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
    }

    // Remove file from disk
    const uploadRoot = path.isAbsolute(process.env.UPLOAD_DIR || '')
      ? process.env.UPLOAD_DIR
      : path.join(__dirname, '../..', process.env.UPLOAD_DIR || 'uploads');
    const filePath = path.join(uploadRoot, rows[0].url.replace(/^\/uploads\//, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await query('DELETE FROM listing_images WHERE id = $1', [imageId]);

    // If it was primary, promote next image
    if (rows[0].is_primary) {
      await query(
        `UPDATE listing_images SET is_primary = TRUE
         WHERE listing_id = $1
         ORDER BY sort_order LIMIT 1`,
        [rows[0].listing_id]
      );
    }

    res.json({ success: true, message: 'Fotoğraf silindi.' });
  } catch (err) { next(err); }
};

// PATCH /api/upload/listing-images/:imageId/primary
const setPrimaryImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const img = await query(
      'SELECT li.listing_id, l.user_id FROM listing_images li JOIN listings l ON l.id = li.listing_id WHERE li.id = $1',
      [imageId]
    );
    if (!img.rows.length) return res.status(404).json({ success: false, message: 'Fotoğraf bulunamadı.' });
    if (img.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
    }

    await query('UPDATE listing_images SET is_primary = FALSE WHERE listing_id = $1', [img.rows[0].listing_id]);
    await query('UPDATE listing_images SET is_primary = TRUE WHERE id = $1', [imageId]);

    res.json({ success: true, message: 'Ana fotoğraf güncellendi.' });
  } catch (err) { next(err); }
};

module.exports = { upload, uploadListingImages, deleteListingImage, setPrimaryImage };
