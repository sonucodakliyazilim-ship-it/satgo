const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { query, withTransaction } = require('../config/database');

const MAX_LISTING_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES_PER_LISTING = 10;
const IMAGE_PROCESS_CONCURRENCY = 5;
const IMAGE_MAX_DIMENSION = 1920;
const IMAGE_OUTPUT_QUALITY = Number(process.env.LISTING_IMAGE_QUALITY || 78);
const IMAGE_REENCODE_MIN_BYTES = 1024 * 1024;
const UPLOAD_DEBUG = process.env.UPLOAD_DEBUG === 'true';
const ALWAYS_LOG_STEPS = new Set([
  'multer.parse.start',
  'multer.parse.end',
  'multer.parse.error',
  'request.start',
  'request.end',
  'request.error',
  'response.finish',
  'response.close',
  'prepare.all.start',
  'prepare.all.end',
  'transaction.end',
]);

sharp.concurrency(Number(process.env.SHARP_CONCURRENCY || 2));

const storage = multer.memoryStorage();

const uploadLog = (step, details = {}) => {
  if (!UPLOAD_DEBUG && !ALWAYS_LOG_STEPS.has(step)) return;
  console.log(`[upload] ${step}`, {
    ...details,
    at: new Date().toISOString(),
  });
};

const uploadWarn = (step, details = {}) => {
  console.warn(`[upload] ${step}`, {
    ...details,
    at: new Date().toISOString(),
  });
};

const getListingImageStorageMode = () =>
  (process.env.LISTING_IMAGE_STORAGE || 'database').trim().toLowerCase();

const isDatabaseImageStorage = () => getListingImageStorageMode() !== 'filesystem';

const getUploadRoot = () =>
  path.isAbsolute(process.env.UPLOAD_DIR || '')
    ? process.env.UPLOAD_DIR
    : path.join(__dirname, '../..', process.env.UPLOAD_DIR || 'uploads');

const extensionByMime = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
};

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const blockedExtensions = new Set(['.heic', '.heif']);
const allowedMimes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);
const blockedMimes = new Set(['image/heic', 'image/heif']);

const ensureUploadSchema = async () => {
  await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS listing_images (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    ALTER TABLE listing_images
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await query('DROP TRIGGER IF EXISTS update_listing_images_updated_at ON listing_images');
  await query(`
    ALTER TABLE listing_images
      DROP COLUMN IF EXISTS thumbnail_url CASCADE,
      DROP COLUMN IF EXISTS mime_type CASCADE,
      DROP COLUMN IF EXISTS file_size CASCADE,
      DROP COLUMN IF EXISTS updated_at CASCADE
  `);

  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'listing_images'
          AND column_name = 'url'
      ) THEN
        UPDATE listing_images SET image_url = url WHERE image_url IS NULL AND url IS NOT NULL;
        ALTER TABLE listing_images DROP COLUMN url CASCADE;
      END IF;
    END $$;
  `);

  await query(`
    UPDATE listing_images
    SET image_url = '/uploads/missing-image-' || id::text
    WHERE image_url IS NULL
  `);

  await query('ALTER TABLE listing_images ALTER COLUMN image_url SET NOT NULL');

  await query(`
    CREATE TABLE IF NOT EXISTS listing_image_files (
      image_id UUID PRIMARY KEY REFERENCES listing_images(id) ON DELETE CASCADE,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL DEFAULT 0,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_listing_images_primary ON listing_images(listing_id, is_primary)');
  await query('CREATE INDEX IF NOT EXISTS idx_listing_images_sort ON listing_images(listing_id, sort_order)');
};

const ensureUploadSchemaForRequest = () =>
  process.env.UPLOAD_SCHEMA_ENSURE === 'true' ? ensureUploadSchema() : Promise.resolve();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  uploadLog('fileFilter.check', { originalName: file.originalname, ext, mime });

  if (blockedExtensions.has(ext) || blockedMimes.has(mime)) {
    const err = new Error('HEIC/HEIF desteklenmiyor. JPG, PNG, WEBP, AVIF veya GIF yükleyin.');
    err.status = 400;
    uploadWarn('fileFilter.reject.heic', { originalName: file.originalname, ext, mime });
    cb(err, false);
    return;
  }

  if ((ext && allowedExtensions.has(ext) && (!mime || allowedMimes.has(mime))) || (!ext && allowedMimes.has(mime))) {
    uploadLog('fileFilter.accept', { originalName: file.originalname, ext, mime });
    cb(null, true);
    return;
  }

  const err = new Error('Sadece JPG, PNG, WEBP, AVIF veya GIF görsel dosyaları kabul edilir.');
  err.status = 400;
  uploadWarn('fileFilter.reject.type', { originalName: file.originalname, ext, mime });
  cb(err, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_LISTING_FILE_SIZE,
    files: MAX_FILES_PER_LISTING,
    fields: 20,
    parts: MAX_FILES_PER_LISTING + 20,
    fieldSize: 3 * 1024 * 1024,
  },
});

const uploadMiddleware = (fieldName, maxCount) => (req, res, next) => {
  if (typeof req.setTimeout === 'function') req.setTimeout(0);
  if (typeof res.setTimeout === 'function') res.setTimeout(0);
  if (req.socket && typeof req.socket.setTimeout === 'function') req.socket.setTimeout(0);

  uploadLog('multer.parse.start', {
    fieldName,
    maxCount,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
  });
  const handler = upload.array(fieldName, maxCount);
  const started = Date.now();
  handler(req, res, (err) => {
    uploadLog(err ? 'multer.parse.error' : 'multer.parse.end', {
      fieldName,
      error: err ? err.message : null,
      fileCount: (req.files || []).length,
      durationMs: Date.now() - started,
    });
    next(err);
  });
};

const resolveStoredUploadPath = (url) => {
  if (!url || url.startsWith('data:')) return null;

  const uploadRoot = path.resolve(getUploadRoot());
  const relative = url.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
  const filePath = path.resolve(uploadRoot, relative);

  if (!filePath.startsWith(uploadRoot + path.sep) && filePath !== uploadRoot) return null;
  return filePath;
};

const processImageBuffer = async (file, index) => {
  const fileBuffer = file.buffer;
  const mime = String(file.mimetype || '').toLowerCase();
  const animated = mime === 'image/gif';
  const started = Date.now();
  const originalResult = {
    buffer: fileBuffer,
    mimeType: mime || 'image/jpeg',
    ext: extensionByMime[mime] || path.extname(file.originalname).toLowerCase() || '.jpg',
    optimized: false,
  };

  uploadLog('sharp.metadata.start', {
    index,
    originalName: file.originalname,
    mime,
    bytes: fileBuffer.length,
  });

  try {
    const image = sharp(fileBuffer, { failOnError: false, animated });
    const metadata = await image.metadata();
    const shouldResize =
      (metadata.width && metadata.width > IMAGE_MAX_DIMENSION) ||
      (metadata.height && metadata.height > IMAGE_MAX_DIMENSION);
    const shouldReencode =
      !animated &&
      (shouldResize ||
        fileBuffer.length >= IMAGE_REENCODE_MIN_BYTES ||
        !['jpeg', 'jpg'].includes(String(metadata.format || '').toLowerCase()));

    uploadLog('sharp.metadata.end', {
      index,
      originalName: file.originalname,
      width: metadata.width || null,
      height: metadata.height || null,
      format: metadata.format || null,
      animated,
      shouldResize,
      shouldReencode,
      durationMs: Date.now() - started,
    });

    if (!shouldReencode) {
      uploadLog('sharp.optimize.skip', {
        index,
        originalName: file.originalname,
        reason: 'inside-limit',
        maxDimension: IMAGE_MAX_DIMENSION,
      });
      return originalResult;
    }

    const optimizeStarted = Date.now();
    uploadLog('sharp.optimize.start', {
      index,
      originalName: file.originalname,
      maxDimension: IMAGE_MAX_DIMENSION,
      animated,
      quality: IMAGE_OUTPUT_QUALITY,
    });

    let pipeline = sharp(fileBuffer, { failOnError: false });
    pipeline = pipeline.rotate();
    pipeline = pipeline.resize({
      width: IMAGE_MAX_DIMENSION,
      height: IMAGE_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
    pipeline = pipeline.jpeg({
      quality: IMAGE_OUTPUT_QUALITY,
      mozjpeg: false,
    });

    const optimized = await pipeline.toBuffer();
    uploadLog('sharp.optimize.end', {
      index,
      originalName: file.originalname,
      originalBytes: fileBuffer.length,
      optimizedBytes: optimized.length,
      durationMs: Date.now() - optimizeStarted,
    });

    if (!shouldResize && optimized.length >= fileBuffer.length * 0.95) {
      uploadLog('sharp.optimize.keep-original', {
        index,
        originalName: file.originalname,
        originalBytes: fileBuffer.length,
        optimizedBytes: optimized.length,
      });
      return originalResult;
    }

    return {
      buffer: optimized,
      mimeType: 'image/jpeg',
      ext: '.jpg',
      optimized: true,
    };
  } catch (err) {
    uploadWarn('sharp.optimize.error.original-kept', {
      index,
      originalName: file.originalname,
      message: err.message,
      durationMs: Date.now() - started,
    });
    return originalResult;
  }
};

const prepareListingImage = async (listingId, file, index) => {
  const startTime = Date.now();
  uploadLog('prepare.start', {
    listingId,
    index,
    originalName: file.originalname,
    mime: file.mimetype,
    bytes: file.buffer.length,
    storageMode: getListingImageStorageMode(),
  });

  const processedImage = await processImageBuffer(file, index);
  uploadLog('prepare.processed', {
    listingId,
    index,
    originalName: file.originalname,
    originalSize: file.buffer.length,
    processedSize: processedImage.buffer.length,
    mimeType: processedImage.mimeType,
    optimized: processedImage.optimized,
    durationMs: Date.now() - startTime,
  });

  if (isDatabaseImageStorage()) {
    uploadLog('database.buffer.ready', {
      listingId,
      index,
      originalName: file.originalname,
      bytes: processedImage.buffer.length,
    });
    return {
      storage: 'database',
      buffer: processedImage.buffer,
      mimeType: processedImage.mimeType,
    };
  }

  const uploadRoot = getUploadRoot();
  const directory = path.join(uploadRoot, 'listings', String(listingId));
  const ext = processedImage.ext || extensionByMime[processedImage.mimeType] || path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const filePath = path.join(directory, filename);

  try {
    uploadLog('filesystem.write.start', { listingId, index, filePath });
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(filePath, processedImage.buffer);
    uploadLog('filesystem.write.end', { listingId, index, filePath, bytes: processedImage.buffer.length });
  } catch (err) {
    if (['EACCES', 'ENOENT', 'ENOSPC', 'EROFS'].includes(err.code)) {
      err.status = 500;
      err.message = 'Sunucuda fotoğraf yükleme dizinine yazılamıyor. UPLOAD_DIR ve disk izinlerini kontrol edin.';
    }
    throw err;
  }

  return { storage: 'filesystem', url: `/uploads/listings/${listingId}/${filename}` };
};

const assertListingOwnership = async (client, listingId, user, forUpdate = false) => {
  const { rows } = await client.query(
    `SELECT user_id FROM listings WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [listingId],
  );

  if (!rows.length) {
    const err = new Error('İlan bulunamadı.');
    err.status = 404;
    throw err;
  }

  if (rows[0].user_id !== user.id && user.role !== 'admin') {
    const err = new Error('Yetkiniz yok.');
    err.status = 403;
    throw err;
  }
};

const runInBatches = async (items, limit, worker, step) => {
  const results = [];
  for (let offset = 0; offset < items.length; offset += limit) {
    const batch = items.slice(offset, offset + limit);
    const batchNumber = Math.floor(offset / limit) + 1;
    const started = Date.now();

    uploadLog(`${step}.batch.start`, {
      batchNumber,
      offset,
      batchSize: batch.length,
      parallelLimit: limit,
    });

    const batchResults = await Promise.all(
      batch.map((item, index) => worker(item, offset + index)),
    );

    uploadLog(`${step}.batch.end`, {
      batchNumber,
      batchSize: batch.length,
      durationMs: Date.now() - started,
    });

    results.push(...batchResults);
  }
  return results;
};

const insertListingImages = async ({ listingId, files, user }) => {
  const startTime = Date.now();
  uploadLog('insert.start', { listingId, fileCount: files?.length || 0, userId: user.id });
  await ensureUploadSchemaForRequest();
  uploadLog('schema.ensure.end', { listingId });

  if (!files || files.length === 0) {
    const err = new Error('Dosya seçilmedi.');
    err.status = 400;
    uploadWarn('insert.reject.empty', { listingId });
    throw err;
  }

  uploadLog('ownership.check.start', { listingId, userId: user.id });
  await assertListingOwnership({ query }, listingId, user);
  uploadLog('ownership.check.end', { listingId, userId: user.id });

  uploadLog('count.check.start', { listingId, incoming: files.length });
  const existing = await query('SELECT COUNT(*) FROM listing_images WHERE listing_id = $1', [listingId]);
  const existingCount = parseInt(existing.rows[0].count, 10);
  uploadLog('count.check.end', { listingId, existingCount, incoming: files.length });
  if (existingCount + files.length > MAX_FILES_PER_LISTING) {
    const err = new Error(`En fazla ${MAX_FILES_PER_LISTING} fotoğraf yükleyebilirsiniz.`);
    err.status = 400;
    uploadWarn('insert.reject.limit', { listingId, existingCount, incoming: files.length, max: MAX_FILES_PER_LISTING });
    throw err;
  }

  const preparedImages = [];

  try {
    uploadLog('prepare.all.start', {
      listingId,
      fileCount: files.length,
      parallelLimit: IMAGE_PROCESS_CONCURRENCY,
      maxDimension: IMAGE_MAX_DIMENSION,
    });

    preparedImages.push(
      ...(await runInBatches(
        files,
        IMAGE_PROCESS_CONCURRENCY,
        (file, index) => prepareListingImage(listingId, file, index),
        'prepare',
      )),
    );

    uploadLog('prepare.all.end', {
      listingId,
      preparedCount: preparedImages.length,
      durationMs: Date.now() - startTime,
    });

    return await withTransaction(async (client) => {
      uploadLog('transaction.start', { listingId, preparedCount: preparedImages.length });
      await assertListingOwnership(client, listingId, user, true);
      uploadLog('transaction.ownership.locked', { listingId, userId: user.id });

      const currentCountResult = await client.query('SELECT COUNT(*) FROM listing_images WHERE listing_id = $1', [listingId]);
      const currentCount = parseInt(currentCountResult.rows[0].count, 10);
      uploadLog('transaction.count.checked', { listingId, currentCount, incoming: preparedImages.length });
      if (currentCount + preparedImages.length > MAX_FILES_PER_LISTING) {
        const err = new Error(`En fazla ${MAX_FILES_PER_LISTING} fotoğraf yükleyebilirsiniz.`);
        err.status = 400;
        uploadWarn('transaction.reject.limit', { listingId, currentCount, incoming: preparedImages.length, max: MAX_FILES_PER_LISTING });
        throw err;
      }

      const primary = await client.query(
        'SELECT id FROM listing_images WHERE listing_id = $1 AND is_primary = TRUE LIMIT 1',
        [listingId],
      );
      const hasPrimary = primary.rows.length > 0;
      const rows = [];

      for (const [index, prepared] of preparedImages.entries()) {
        const imageId = crypto.randomUUID();
        const imageUrl = prepared.storage === 'database'
          ? `/api/upload/listing-images/${imageId}/file`
          : prepared.url;

        uploadLog('db.image.insert.start', {
          listingId,
          index,
          imageId,
          storage: prepared.storage,
          isPrimary: !hasPrimary && index === 0,
        });

        const insertedImage = await client.query(
          `INSERT INTO listing_images (id, listing_id, image_url, sort_order, is_primary)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id, listing_id, image_url, image_url AS url, sort_order, is_primary, created_at`,
          [
            imageId,
            listingId,
            imageUrl,
            currentCount + index,
            !hasPrimary && index === 0,
          ],
        );

        uploadLog('db.image.insert.end', { listingId, index, imageId });

        if (prepared.storage === 'database') {
          uploadLog('db.file.insert.start', {
            listingId,
            index,
            imageId,
            mimeType: prepared.mimeType,
            bytes: prepared.buffer.length,
          });
          await client.query(
            `INSERT INTO listing_image_files (image_id, mime_type, byte_size, data)
             VALUES ($1,$2,$3,$4)`,
            [imageId, prepared.mimeType, prepared.buffer.length, prepared.buffer],
          );
          uploadLog('db.file.insert.end', { listingId, index, imageId });
        }

        rows.push(insertedImage.rows[0]);
      }

      uploadLog('transaction.end', {
        listingId,
        insertedCount: rows.length,
        durationMs: Date.now() - startTime,
      });

      return rows;
    });
  } catch (err) {
    uploadWarn('insert.cleanup.start', { listingId, preparedCount: preparedImages.length, message: err.message });
    await Promise.all(preparedImages.map(async (image) => {
      const filePath = image.storage === 'filesystem' ? resolveStoredUploadPath(image.url) : null;
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch(() => {});
      }
    }));
    uploadWarn('insert.error', { listingId, message: err.message, durationMs: Date.now() - startTime });
    throw err;
  }
};

const uploadListingImages = async (req, res, next) => {
  const requestStart = Date.now();
  res.on('finish', () => {
    uploadLog('response.finish', {
      listingId: req.params.listingId,
      statusCode: res.statusCode,
      durationMs: Date.now() - requestStart,
      event: 'finish',
    });
  });
  res.on('close', () => {
    uploadLog('response.close', {
      listingId: req.params.listingId,
      statusCode: res.statusCode,
      durationMs: Date.now() - requestStart,
      event: 'close',
    });
  });
  uploadLog('request.start', { listingId: req.params.listingId, fileCount: (req.files || []).length, userId: req.user?.id });
  try {
    const inserted = await insertListingImages({
      listingId: req.params.listingId,
      files: req.files,
      user: req.user,
    });

    uploadLog('request.end', { listingId: req.params.listingId, inserted: inserted.length, durationMs: Date.now() - requestStart });
    uploadLog('response.send', { listingId: req.params.listingId, inserted: inserted.length, statusCode: 200 });

    res.json({ success: true, message: `${inserted.length} fotoğraf yüklendi.`, data: inserted });
  } catch (err) {
    uploadWarn('request.error', { listingId: req.params.listingId, message: err.message, durationMs: Date.now() - requestStart });
    next(err);
  }
};

const getListingImageFile = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT lif.mime_type, lif.byte_size, lif.data
       FROM listing_image_files lif
       JOIN listing_images li ON li.id = lif.image_id
       JOIN listings l ON l.id = li.listing_id
       WHERE lif.image_id = $1
         AND l.status IN ('active', 'passive', 'sold')`,
      [req.params.imageId],
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Fotoğraf bulunamadı.' });
    }

    const file = rows[0];
    res.set({
      'Content-Type': file.mime_type,
      'Content-Length': file.byte_size,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return res.send(file.data);
  } catch (err) {
    next(err);
  }
};

const deleteListingImage = async (req, res, next) => {
  try {
    await ensureUploadSchemaForRequest();
    const { rows } = await query(
      `SELECT li.*, l.user_id
       FROM listing_images li
       JOIN listings l ON l.id = li.listing_id
       WHERE li.id = $1`,
      [req.params.imageId],
    );

    if (!rows.length) return res.status(404).json({ success: false, message: 'Fotoğraf bulunamadı.' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
    }

    const filePath = resolveStoredUploadPath(rows[0].image_url);
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    await query('DELETE FROM listing_images WHERE id = $1', [req.params.imageId]);

    if (rows[0].is_primary) {
      await query(
        `UPDATE listing_images
         SET is_primary = TRUE
         WHERE id = (
           SELECT id
           FROM listing_images
           WHERE listing_id = $1
           ORDER BY sort_order ASC, created_at ASC
           LIMIT 1
         )`,
        [rows[0].listing_id],
      );
    }

    res.json({ success: true, message: 'Fotoğraf silindi.' });
  } catch (err) {
    next(err);
  }
};

const setPrimaryImage = async (req, res, next) => {
  try {
    await ensureUploadSchemaForRequest();
    const img = await query(
      `SELECT li.listing_id, l.user_id
       FROM listing_images li
       JOIN listings l ON l.id = li.listing_id
       WHERE li.id = $1`,
      [req.params.imageId],
    );

    if (!img.rows.length) return res.status(404).json({ success: false, message: 'Fotoğraf bulunamadı.' });
    if (img.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
    }

    await withTransaction(async (client) => {
      await client.query('UPDATE listing_images SET is_primary = FALSE WHERE listing_id = $1', [img.rows[0].listing_id]);
      await client.query('UPDATE listing_images SET is_primary = TRUE WHERE id = $1', [req.params.imageId]);
    });

    res.json({ success: true, message: 'Ana fotoğraf güncellendi.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upload,
  uploadMiddleware,
  insertListingImages,
  uploadListingImages,
  getListingImageFile,
  deleteListingImage,
  setPrimaryImage,
};
