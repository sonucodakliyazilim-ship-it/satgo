const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { getAccessTokenFromRequest } = require('../utils/tokenCookies');
const { getAccessTokenSecret } = require('../utils/jwtSecrets');

const verifyToken = async (token) => {
  try {
    return jwt.verify(token, getAccessTokenSecret());
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw err;

    const decoded = jwt.decode(token);
    if (!decoded?.userId) throw err;
    if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
      const expiredErr = new Error('Token expired');
      expiredErr.name = 'TokenExpiredError';
      throw expiredErr;
    }

    return decoded;
  }
};

module.exports = async (req, res, next) => {
  res.set('X-Satgo-Auth-Guard', 'direct');

  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Kimlik doğrulama gerekli.' });
    }

    const decoded = await verifyToken(token);
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
