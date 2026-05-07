const jwt  = require('jsonwebtoken');
const { query } = require('../config/database');
const { getAccessTokenFromRequest } = require('../utils/tokenCookies');
const { findIssuedAccessToken } = require('../utils/tokenStore');

const verifyAccessToken = async (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw err;

    const decoded = jwt.decode(token);
    if (!decoded?.userId) throw err;
    if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
      const expiredErr = new Error('Token expired');
      expiredErr.name = 'TokenExpiredError';
      throw expiredErr;
    }

    const issued = await findIssuedAccessToken(token);
    if (!issued || issued.user_id !== decoded.userId) throw err;
    return decoded;
  }
};

// Verify access token
const authenticate = async (req, res, next) => {
  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Kimlik doğrulama gerekli.' });
    }

    const decoded = await verifyAccessToken(token);

    // Fetch fresh user data
    const { rows } = await query(
      'SELECT id, name, email, role, status, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    const user = rows[0];
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Hesabınız engellenmiştir.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Oturum süresi doldu.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Geçersiz token.' });
  }
};

// Optional auth - doesn't fail if no token, just sets req.user = null
const optionalAuth = async (req, res, next) => {
  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      req.user = null;
      return next();
    }
    const decoded = await verifyAccessToken(token);
    const { rows } = await query(
      'SELECT id, name, email, role, status, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );
    req.user = rows[0] || null;
  } catch {
    req.user = null;
  }
  next();
};

// Admin-only guard
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
  }
  next();
};

// Listing ownership guard (use after authenticate)
const requireOwner = (paramField = 'id') => async (req, res, next) => {
  const listingId = req.params[paramField];
  const { rows } = await query('SELECT user_id FROM listings WHERE id = $1', [listingId]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'İlan bulunamadı.' });
  if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
  }
  next();
};

module.exports = { authenticate, optionalAuth, requireAdmin, requireOwner };
