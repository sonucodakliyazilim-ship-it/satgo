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

// TEST 1: Auth bypass (sadece token decode, DB sorgusu YOK)
const directAuthJwtOnly = async (req, res, next) => {
  console.log('🔵 [directAuth.test] auth.enter');
  res.set('X-Satgo-Auth-Guard', 'jwt-only-test');

  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      console.log('🔴 [directAuth.test] token.read.empty');
      return res.status(401).json({ success: false, message: 'Kimlik doğrulama gerekli.' });
    }

    console.log('🟢 [directAuth.test] token.read.start');
    const decoded = await verifyToken(token);
    console.log('🟢 [directAuth.test] token.read.end userId:', decoded.userId);

    // ⚠️ DB QUERY YOK - SADECE JWT
    req.user = { 
      id: decoded.userId,
      userId: decoded.userId 
    };
    
    console.log('🟢 [directAuth.test] req.user set (no DB query)');
    next();
  } catch (err) {
    console.log('🔴 [directAuth.test] error:', err.message || err.name);
    res.set('X-Satgo-Auth-Error', String(err.message || err.name || 'unknown').slice(0, 120));

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Oturum süresi doldu.', code: 'TOKEN_EXPIRED' });
    }

    return res.status(401).json({ success: false, message: 'Geçersiz token.' });
  }
};

// TEST 2: Auth completely removed
const directAuthNone = async (req, res, next) => {
  console.log('🟡 [directAuth.test] NO AUTH - debug only');
  req.user = { 
    id: 'test-user-id',
    userId: 'test-user-id',
    role: 'user'
  };
  next();
};

module.exports = { directAuthJwtOnly, directAuthNone };
