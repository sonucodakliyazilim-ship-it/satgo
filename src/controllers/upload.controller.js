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
};

const saveListingImage = async (listingId, file) => {
  if ((process.env.LISTING_IMAGE_STORAGE || 'database') !== 'filesystem') {
    const mime = file.mimetype || 'image/jpeg';
    return `data:${mime};base64,${file.buffer.toString('base64')}`;
  }

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

const shouldEnsureUploadSchemaAtRuntime = () =>
  process.env.UPLOAD_SCHEMA_ENSURE === 'true' || process.env.NODE_ENV !== 'production';

const ensureUploadSchema = () => {
  if (!uploadSchemaPromise) {
    uploadSchemaPromise = (async () => {
      await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').catch((err) => {
        console.warn('[upload schema warning]', err.message);
      });
      await query(`
        CREATE TABLE IF NOT EXISTS listing_images (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          is_primary BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      const optionalStatements = [
        'ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0',
        'ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE',
        'ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
        'ALTER TABLE listing_images ALTER COLUMN id SET DEFAULT uuid_generate_v4()',
        'CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id)',
        'CREATE INDEX IF NOT EXISTS idx_listing_images_primary ON listing_images(listing_id, is_primary)',
      ];

      for (const statement of optionalStatements) {
        try {
          await query(statement);
        } catch (err) {
          console.warn('[upload schema warning]', err.message);
        }
      }
    })().catch((err) => {
      uploadSchemaPromise = null;
      throw err;
    });
  }

  return uploadSchemaPromise;
};

const ensureUploadSchemaForRequest = () =>
  shouldEnsureUploadSchemaAtRuntime() ? ensureUploadSchema() : Promise.resolve();

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.avif', '.gif'];
  const allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if ((allowed.includes(ext) && (!mime || allowedMimes.includes(mime))) || (!ext && allowedMimes.includes(mime))) {
    cb(null, true);
    return;
  }

  const err = new Error('Sadece JPG, PNG, WEBP, AVIF veya GIF gorsel dosyalari kabul edilir.');
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

const insertListingImages = async ({ listingId, files, user }) => {
  await ensureUploadSchemaForRequest();

  const listing = await query('SELECT user_id FROM listings WHERE id = $1', [listingId]);
  if (!listing.rows.length) {
    const err = new Error('Ilan bulunamadi.');
    err.status = 404;
    throw err;
  }

  if (listing.rows[0].user_id !== user.id && user.role !== 'admin') {
    const err = new Error('Yetkiniz yok.');
    err.status = 403;
    throw err;
  }

  if (!files || files.length === 0) {
    const err = new Error('Dosya secilmedi.');
    err.status = 400;
    throw err;
  }

  const existing = await query('SELECT COUNT(*) FROM listing_images WHERE listing_id = $1', [listingId]);
  const existingCount = parseInt(existing.rows[0].count, 10);
  const max = parseInt(process.env.MAX_FILES_PER_LISTING, 10) || 10;
  if (existingCount + files.length > max) {
    const err = new Error(`En fazla ${max} fotograf yukleyebilirsiniz.`);
    err.status = 400;
    throw err;
  }

  const primary = await query(
    'SELECT id FROM listing_images WHERE listing_id = $1 AND is_primary = TRUE',
    [listingId],
  );
  const hasPrimary = primary.rows.length > 0;
  const savedUrls = [];

  try {
    const inserted = [];
    for (const [idx, file] of files.entries()) {
      const url = await saveListingImage(listingId, file);
      savedUrls.push(url);

      let rows;
      try {
        const insertedImage = await query(
          `INSERT INTO listing_images (listing_id, url, sort_order, is_primary)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [listingId, url, existingCount + idx, !hasPrimary && idx === 0],
        );
        rows = insertedImage.rows;
      } catch (insertErr) {
        const imageId = crypto.randomUUID();
        const insertedImage = await query(
          `INSERT INTO listing_images (id, listing_id, url, sort_order, is_primary)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [imageId, listingId, url, existingCount + idx, !hasPrimary && idx === 0],
        );
        rows = insertedImage.rows;
      }
      inserted.push(rows[0]);
    }
    return inserted;
  } catch (err) {
    await Promise.all(savedUrls.map(async (url) => {
      const filePath = resolveStoredUploadPath(url);
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch(() => {});
      }
    }));
    throw err;
  }
};

// ── Controller ─────────────────────────────────────────────────

// POST /api/upload/listing-images/:listingId
const uploadListingImages = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const inserted = await insertListingImages({ listingId, files: req.files, user: req.user });

    res.json({ success: true, message: `${inserted.length} fotoğraf yüklendi.`, data: inserted });
  } catch (err) { next(err); }
};

// DELETE /api/upload/listing-images/:imageId
const deleteListingImage = async (req, res, next) => {
  try {
    await ensureUploadSchemaForRequest();
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
    await ensureUploadSchemaForRequest();
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

module.exports = { upload, insertListingImages, uploadListingImages, deleteListingImage, setPrimaryImage };
