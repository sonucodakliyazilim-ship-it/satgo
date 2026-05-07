const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const authRoutes = require('./auth.routes');
const { query } = require('../config/database');
const { setTokenCookies } = require('../utils/tokenCookies');
const { saveAccessToken } = require('../utils/tokenStore');

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (!rows.length) {
      return res.json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password || '', user.password_hash);

    if (!passwordMatches) {
      return res.json({ success: false, message: "Şifre hatalı" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, jti: uuidv4() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, role: user.role, jti: uuidv4() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
    );
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await saveAccessToken(user.id, token);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, refreshExpiresAt]
    );
    setTokenCookies(res, token, refreshToken);

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar_url: user.avatar_url
        },
        accessToken: token,
        refreshToken
      }
    });
  } catch (err) {
    next(err);
  }
});

router.use(authRoutes);

module.exports = router;
