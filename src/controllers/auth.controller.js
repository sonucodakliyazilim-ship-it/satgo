const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const { clearTokenCookies, getRefreshTokenFromRequest, setTokenCookies } = require('../utils/tokenCookies');
const { saveAccessToken } = require('../utils/tokenStore');
const { assertJwtSecrets, getAccessTokenSecret, getRefreshTokenSecret } = require('../utils/jwtSecrets');

// ── Helpers ───────────────────────────────────────────────────

const generateTokens = (userId, role) => {
  assertJwtSecrets();

  const accessToken = jwt.sign(
    { userId, role, jti: uuidv4() },
    getAccessTokenSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, role, jti: uuidv4() },
    getRefreshTokenSecret(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

const saveRefreshToken = async (userId, token) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
};

const getPasswordResetUrl = (token) => {
  const frontendUrl = (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://satgo.vercel.app'
  ).replace(/\/$/, '');

  return `${frontendUrl}/sifre-yenile?token=${encodeURIComponent(token)}`;
};

// ── Controllers ───────────────────────────────────────────────

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, city } = req.body;

    // Check existing email
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'Bu e-posta adresi zaten kayıtlı.' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, rounds);
    const verifyToken = uuidv4();

    const { rows } = await query(
      `INSERT INTO users (name, email, phone, password_hash, city, email_verify_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, status, created_at`,
      [name, email, phone || null, passwordHash, city || null, verifyToken]
    );

    const user = rows[0];
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await saveAccessToken(user.id, accessToken);
    await saveRefreshToken(user.id, refreshToken);
    setTokenCookies(res, accessToken, refreshToken);

    // TODO: send verification email here

    res.status(201).json({
      success: true,
      message: 'Kayıt başarılı.',
      data: { user, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'E-posta veya şifre hatalı.' });
    }

    const user = rows[0];

    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Hesabınız engellenmiştir.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'E-posta veya şifre hatalı.' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await saveAccessToken(user.id, accessToken);
    await saveRefreshToken(user.id, refreshToken);
    setTokenCookies(res, accessToken, refreshToken);
    delete user.password_hash;

    return res.json({
      success: true,
      data: { user, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token gerekli.' });
    }

    // Verify token signature
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, getRefreshTokenSecret());
    } catch {
      return res.status(401).json({ success: false, message: 'Geçersiz refresh token.' });
    }

    // Check DB
    const { rows } = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Refresh token süresi dolmuş.' });
    }

    // Rotate: delete old, issue new
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const { accessToken, refreshToken: newRefresh } = generateTokens(decoded.userId, decoded.role);
    await saveAccessToken(decoded.userId, accessToken);
    await saveRefreshToken(decoded.userId, newRefresh);
    setTokenCookies(res, accessToken, newRefresh);

    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefresh },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    clearTokenCookies(res);
    res.json({ success: true, message: 'Çıkış yapıldı.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);

    // Always return 200 to prevent email enumeration
    if (!rows.length) {
      return res.json({ success: true, message: 'Şifre sıfırlama bağlantısı gönderildi.' });
    }

    const resetToken = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, expires, rows[0].id]
    );

    // TODO: send reset email with resetToken

    res.json({
      success: true,
      message: 'Şifre sıfırlama bağlantısı gönderildi.',
      resetToken,
      resetUrl: getPasswordResetUrl(resetToken),
      data: {
        resetToken,
        resetUrl: getPasswordResetUrl(resetToken),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const { rows } = await query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Token geçersiz veya süresi dolmuş.' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, rounds);

    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, rows[0].id]
    );

    // Invalidate all refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [rows[0].id]);

    res.json({ success: true, message: 'Şifre başarıyla güncellendi.' });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, password } = req.body;
    const { rows } = await query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Mevcut şifre hatalı.' });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, rounds);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);

    res.json({ success: true, message: 'Şifre başarıyla güncellendi. Lütfen tekrar giriş yapın.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
