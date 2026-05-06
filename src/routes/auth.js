const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authRoutes = require('./auth.routes');
const { query } = require('../config/database');

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
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        accessToken: token
      }
    });
  } catch (err) {
    next(err);
  }
});

router.use(authRoutes);

module.exports = router;
