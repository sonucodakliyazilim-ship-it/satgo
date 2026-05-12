const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const { query } = require('../config/database');

// ── Multer config ─────────────────────────────────────────────
const storage = multer.memoryStorage();

const getUploadRoot = () =>
  path.isAbsolute(process.env.UPLOAD_DIR || '')
    ? process.env.UPLOAD_DIR
    : path.join(__dirname, '../..', process.env.UPLOAD_DIR || 'uploads');

const extensionByMime = {
  'image/jpeg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const saveListingImage = async (listingId, file) => {
  const uploadRoot = getUploadRoot();
  const directory = path.join(uploadRoot, 'listings', String(listingId));

  const ext = extensionByMime[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const filePath = path.join(directory, filename);

  try {
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(filePath, file.buffer);
  } catch (err) {
    if (['EACCES', 'ENOENT', 'ENOSPC', 'EROFS'].includes(err.code)) {
      err.status = 500;
      err.message = 'Sunucuda fotoğraf yükleme dizinine yazılamıyor. UPLOAD_DIR ve disk izinlerini kontrol edin.';
    }
    throw err;
  }

  return `/uploads/listings/${listingId}/${filename}`;
};

const resolveStoredUploadPath = (url) => {
  if (!url || url.startsWith('data:')) return null;

  const uploadRoot = path.resolve(getUploadRoot());
  const relative = url.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
  const filePath = path.resolve(uploadRoot, relative);

  if (!filePath.startsWith(uploadRoot + path.sep) && filePath !== uploadRoot) return null;
  return filePath;
};

let uploadSchemaPromise = null;

const ensureUploadSchema = () => {
  if (!uploadSchemaPromise) {
    uploadSchemaPromise = (async () => {
      await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await query(`
        DO $$
        DECLARE
          listing_id_type text;
        BEGIN
          SELECT format_type(a.atttypid, a.atttypmod)
          INTO listing_id_type
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'listings'
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped;

          IF listing_id_type IS NULL THEN
            RAISE EXCEPTION 'listings.id column is required before upload schema can run';
          END IF;

          EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS listing_images (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              listing_id %s NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
              url TEXT NOT NULL,
              sort_order INTEGER DEFAULT 0,
              is_primary BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          $sql$, listing_id_type);
        END $$;
      `);
      await query('ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0');
      await query('ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE');
      await query('ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      await query('CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_listing_images_primary ON listing_images(listing_id, is_primary)');
    })().catch((err) => {
      uploadSchemaPromise = null;
      throw err;
    });
  }

  return uploadSchemaPromise;
};

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.avif', '.gif', '.heic', '.heif'];
  const allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif'];
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if ((allowed.includes(ext) && (allowedMimes.includes(mime) || mime.startsWith('image/'))) || (!ext && allowedMimes.includes(mime))) {
    cb(null, true);
    return;
  }

  const err = new Error('Sadece JPG, PNG, WEBP, AVIF, GIF veya HEIC/HEIF görsel dosyaları kabul edilir.');
  err.status = 400;
  cb(err, false);
};

const configuredMaxFileSize = parseInt(process.env.MAX_FILE_SIZE || '', 10);
const maxListingFileSize = Number.isFinite(configuredMaxFileSize)
  ? Math.max(configuredMaxFileSize, 15 * 1024 * 1024)
  : 15 * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxListingFileSize,
    files:    parseInt(process.env.MAX_FILES_PER_LISTING, 10) || 10,
  },
});

// ── Controller ─────────────────────────────────────────────────

// POST /api/upload/listing-images/:listingId
const uploadListingImages = async (req, res, next) => {
  try {
    await ensureUploadSchema();
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
    const max = parseInt(process.env.MAX_FILES_PER_LISTING, 10) || 10;
    if (parseInt(existing.rows[0].count, 10) + req.files.length > max) {
      return res.status(400).json({ success: false, message: `En fazla ${max} fotoğraf yükleyebilirsiniz.` });
    }

    const isPrimaryExisting = await query(
      'SELECT id FROM listing_images WHERE listing_id = $1 AND is_primary = TRUE',
      [listingId]
    );
    const hasPrimary = isPrimaryExisting.rows.length > 0;

    const inserted = await Promise.all(req.files.map(async (file, idx) => {
      const url = await saveListingImage(listingId, file);
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
    await ensureUploadSchema();
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
    const filePath = resolveStoredUploadPath(rows[0].url);
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    await query('DELETE FROM listing_images WHERE id = $1', [imageId]);

    // If it was primary, promote next image
    if (rows[0].is_primary) {
      await query(
        `UPDATE listing_images
         SET is_primary = TRUE
         WHERE id = (
           SELECT id FROM listing_images
           WHERE listing_id = $1
           ORDER BY sort_order ASC, created_at ASC
           LIMIT 1
         )`,
        [rows[0].listing_id]
      );
    }

    res.json({ success: true, message: 'Fotoğraf silindi.' });
  } catch (err) { next(err); }
};

// PATCH /api/upload/listing-images/:imageId/primary
const setPrimaryImage = async (req, res, next) => {
  try {
    await ensureUploadSchema();
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
