const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { query } = require('../config/database');

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

const saveBannerImage = async (file) => {
  const uploadRoot = getUploadRoot();
  const directory = path.join(uploadRoot, 'banners');
  await fs.promises.mkdir(directory, { recursive: true });

  const ext = extensionByMime[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(directory, filename), file.buffer);
  return `/uploads/banners/${filename}`;
};

const resolveStoredUploadPath = (url) => {
  if (!url || url.startsWith('data:')) return null;
  const uploadRoot = path.resolve(getUploadRoot());
  const relative = url.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
  const filePath = path.resolve(uploadRoot, relative);
  if (!filePath.startsWith(uploadRoot + path.sep) && filePath !== uploadRoot) return null;
  return filePath;
};

const ensureBannerTable = async () => {
  await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await query(`
    CREATE TABLE IF NOT EXISTS banners (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title VARCHAR(160) NOT NULL,
      subtitle TEXT,
      image_url TEXT NOT NULL,
      href TEXT DEFAULT '/ilanlar',
      placement VARCHAR(40) NOT NULL DEFAULT 'home_hero',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const uploadBanner = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.avif', '.gif'];
    const allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExts.includes(ext) && allowedMimes.includes((file.mimetype || '').toLowerCase())) cb(null, true);
    else {
      const err = new Error('Sadece JPG, PNG, WEBP, AVIF veya GIF dosyalari kabul edilir.');
      err.status = 400;
      cb(err, false);
    }
  },
  limits: { fileSize: Math.max(parseInt(process.env.MAX_FILE_SIZE || '', 10) || 0, 15 * 1024 * 1024) },
});

const getPublicBanners = async (req, res, next) => {
  try {
    await ensureBannerTable();
    const { placement } = req.query;
    const params = [];
    let where = 'WHERE is_active = TRUE';
    if (placement) {
      params.push(placement);
      where += ' AND placement = $1';
    }
    const { rows } = await query(
      `SELECT id, title, subtitle, image_url, href, placement, sort_order
       FROM banners
       ${where}
       ORDER BY sort_order ASC, created_at DESC`,
      params,
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

const getAdminBanners = async (req, res, next) => {
  try {
    await ensureBannerTable();
    const { rows } = await query('SELECT * FROM banners ORDER BY sort_order ASC, created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

const createBanner = async (req, res, next) => {
  try {
    await ensureBannerTable();
    const { title, subtitle, href, placement, sort_order, is_active } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Banner gorseli secin.' });

    const { rows } = await query(
      `INSERT INTO banners (title, subtitle, image_url, href, placement, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        title,
        subtitle || null,
        await saveBannerImage(req.file),
        href || '/ilanlar',
        placement || 'home_hero',
        Number(sort_order || 0),
        is_active === 'false' ? false : true,
      ],
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateBanner = async (req, res, next) => {
  try {
    await ensureBannerTable();
    const current = await query('SELECT * FROM banners WHERE id = $1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ success: false, message: 'Banner bulunamadi.' });

    const { title, subtitle, href, placement, sort_order, is_active } = req.body;
    const imageUrl = req.file ? await saveBannerImage(req.file) : current.rows[0].image_url;
    const { rows } = await query(
      `UPDATE banners SET
         title = COALESCE($1, title),
         subtitle = $2,
         image_url = $3,
         href = COALESCE($4, href),
         placement = COALESCE($5, placement),
         sort_order = COALESCE($6, sort_order),
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        title || null,
        subtitle || null,
        imageUrl,
        href || null,
        placement || null,
        sort_order === undefined ? null : Number(sort_order),
        is_active === undefined ? null : is_active === 'true' || is_active === true,
        req.params.id,
      ],
    );

    if (req.file) {
      const oldPath = resolveStoredUploadPath(current.rows[0].image_url);
      if (oldPath && fs.existsSync(oldPath)) {
        await fs.promises.unlink(oldPath);
      }
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    await ensureBannerTable();
    const { rows } = await query('DELETE FROM banners WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Banner bulunamadi.' });
    const filePath = resolveStoredUploadPath(rows[0].image_url);
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    res.json({ success: true, message: 'Banner silindi.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadBanner,
  getPublicBanners,
  getAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
};
