require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const { pool }   = require('./config/database');
const socketHandler = require('./utils/socketHandler');

// Routes
const authRoutes        = require('./routes/auth.routes');
const userRoutes        = require('./routes/user.routes');
const listingRoutes     = require('./routes/listing.routes');
const categoryRoutes    = require('./routes/category.routes');
const favoriteRoutes    = require('./routes/favorite.routes');
const messageRoutes     = require('./routes/message.routes');
const promotionRoutes   = require('./routes/promotion.routes');
const adminRoutes       = require('./routes/admin.routes');
const uploadRoutes      = require('./routes/upload.routes');
const bannerRoutes      = require('./routes/banner.routes');

const app    = express();
const server = http.createServer(app);
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
};
const io     = new Server(server, {
  cors: {
    origin: Array.from(allowedOrigins),
    methods: ['GET', 'POST'],
    credentials: true,
  }
});
app.set('io', io);

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (uploaded images)
const uploadRoot = path.isAbsolute(process.env.UPLOAD_DIR || '')
  ? process.env.UPLOAD_DIR
  : path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadRoot));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || (process.env.NODE_ENV === 'development' ? 10000 : 100),
  message:  { success: false, message: 'Çok fazla istek. Lütfen bekleyin.' },
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : 10,
  message: { success: false, message: 'Çok fazla giriş denemesi. 15 dakika bekleyin.' },
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',       authLimiter, authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/listings',   listingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/favorites',  favoriteRoutes);
app.use('/api/messages',   messageRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/banners',    bannerRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/upload',     uploadRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'ilanGO API çalışıyor', db: 'connected' });
  } catch {
    res.status(500).json({ success: false, message: 'DB bağlantısı yok' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint bulunamadı.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Sunucu hatası.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Socket.io ─────────────────────────────────────────────────
socketHandler(io);

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════╗
  ║  ilanGO API  →  port ${PORT}       ║
  ║  ENV: ${process.env.NODE_ENV || 'development'}             ║
  ╚══════════════════════════════════╝
  `);
});

module.exports = { app, io };
