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
  res.set('X-Satgo-Auth-Guard', 'direct-decode-v2');

  try {
    console.log('[auth.enter]');
    console.log('[directAuth] start', req.method, req.url);
    const token = getAccessTokenFromRequest(req);
    console.log('[token.read.start]');
    if (!token) {
      console.log('[token.read.end] no-token');
      console.log('[directAuth] no token');
      return res.status(401).json({ success: false, message: 'Kimlik doğrulama gerekli.' });
    }

    console.log('[token.read.end]');
    console.log('[directAuth] verifying');
    const decoded = await verifyToken(token);
    console.log('[directAuth] decoded userId=', decoded?.userId, 'querying user');
    console.log('[db.query.start] SELECT users');
    const { rows } = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    console.log('[db.query.end] rows=', rows.length);
    console.log('[directAuth] query done found=', rows.length);

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    const user = rows[0];
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Hesabınız engellenmiştir.' });
    }

    req.user = user;
    console.log('[directAuth] next');
    next();
  } catch (err) {
    console.log('[directAuth] err', err.name, err.message);
    res.set('X-Satgo-Auth-Error', String(err.message || err.name || 'unknown').slice(0, 120));

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Oturum süresi doldu.', code: 'TOKEN_EXPIRED' });
    }

    return res.status(401).json({ success: false, message: 'Geçersiz token.' });
  }
};
