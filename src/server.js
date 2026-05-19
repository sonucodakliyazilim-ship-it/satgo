const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { body } = require('express-validator');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, query } = require('./config/database');
const socketHandler = require('./utils/socketHandler');
const auth = require('./middleware/auth');
const directAuth = require('./middleware/directAuth');
const { validate } = require('./middleware/validate.middleware');

const authRoutes = require('./routes/auth');
const userController = require('./controllers/user.controller');
const listingController = require('./controllers/listing.controller');
const uploadController = require('./controllers/upload.controller');
const userRoutes = require('./routes/user.routes');
const listingRoutes = require('./routes/listing.routes');
const categoryRoutes = require('./routes/category.routes');
const favoriteRoutes = require('./routes/favorite.routes');
const messageRoutes = require('./routes/message.routes');
const promotionRoutes = require('./routes/promotion.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const bannerRoutes = require('./routes/banner.routes');
const hierarchyRoutes = require('./routes/hierarchy.routes');
const customFieldRoutes = require('./routes/customField.routes');

const app = express();
const server = http.createServer(app);
server.requestTimeout = 0;
server.headersTimeout = 0;

app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

app.set('io', io);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadRoot = path.isAbsolute(process.env.UPLOAD_DIR || '')
  ? process.env.UPLOAD_DIR
  : path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadRoot));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Çok fazla istek. Lütfen bekleyin.' },
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);

app.get('/api/users/me/profile', directAuth, userController.getMe);
app.get('/api/listings/me', directAuth, listingController.getMyListings);
app.post('/api/listings/with-images',
  directAuth,
  uploadController.uploadMiddleware('images', 10),
  listingController.createListingWithImages,
);
app.post('/api/listings',
  directAuth,
  [
    body('category_id').isInt({ min: 1 }).withMessage('Geçerli bir kategori seçin.'),
    body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Başlık 5-200 karakter olmalıdır.'),
    body('price').optional().isNumeric().isFloat({ min: 0 }).withMessage('Geçerli bir fiyat girin.'),
    body('city').notEmpty().withMessage('Şehir seçimi zorunludur.'),
  ],
  validate,
  listingController.createListing,
);
app.post('/api/upload/listing-images/:listingId',
  directAuth,
  uploadController.uploadMiddleware('images', 10),
  uploadController.uploadListingImages,
);

app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/me', auth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.userId]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'API çalışıyor', db: 'connected' });
  } catch {
    res.status(500).json({ success: false, message: 'DB bağlantısı yok' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint bulunamadı.' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  let message = err.message || 'Sunucu hatası.';
  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'Fotoğraf boyutu en fazla 15 MB olabilir.';
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    message = 'En fazla 10 fotoğraf yükleyebilirsiniz.';
  } else if (err.code === 'LIMIT_PART_COUNT' || err.code === 'LIMIT_FIELD_COUNT') {
    message = 'Yükleme isteği çok büyük veya geçersiz. Lütfen fotoğrafları azaltıp tekrar deneyin.';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    message = 'Fotoğraflar images alanı ile yüklenmelidir.';
  }

  res.status(status).json({
    success: false,
    message,
  });
});

socketHandler(io);

const PORT = process.env.PORT || 5001;
console.log('[server] listening on port', PORT);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server çalışıyor: ${PORT}`);
  console.log('[server] socket and routes ready');
});

server.on('error', (err) => {
  console.error('[Server Error]', err.code, err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err.message);
  process.exit(1);
});

process.on('exit', (code) => {
  console.log('[Process Exit]', code);
});

module.exports = { app, io };
