const bcrypt  = require('bcryptjs');
const { query } = require('../config/database');

// GET /api/users/me
const getMe = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0] || {};
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        avatar_url: user.avatar_url || null,
        bio: user.bio || null,
        city: user.city || null,
        district: user.district || null,
        role: user.role || 'user',
        status: user.status || 'active',
        email_verified: user.email_verified || false,
        phone_verified: user.phone_verified || false,
        rating_avg: user.rating_avg || 0,
        rating_count: user.rating_count || 0,
        listing_count: user.listing_count || 0,
        created_at: user.created_at,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/users/:id  — public profile
const getUser = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1 AND status = $2', [req.params.id, 'active']);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    const user = rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url || null,
        bio: user.bio || null,
        city: user.city || null,
        rating_avg: user.rating_avg || 0,
        rating_count: user.rating_count || 0,
        listing_count: user.listing_count || 0,
        created_at: user.created_at,
      },
    });
  } catch (err) { next(err); }
};

// PATCH /api/users/me
const updateMe = async (req, res, next) => {
  try {
    const { name, phone, bio, city, district, avatar_url } = req.body;
    const { rows } = await query(
      `UPDATE users SET
         name       = COALESCE($1, name),
         phone      = COALESCE($2, phone),
         bio        = COALESCE($3, bio),
         city       = COALESCE($4, city),
         district   = COALESCE($5, district),
         avatar_url = COALESCE($6, avatar_url),
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, email, phone, bio, city, district, avatar_url, updated_at`,
      [name, phone, bio, city, district, avatar_url, req.user.id]
    );
    res.json({ success: true, message: 'Profil güncellendi.', data: rows[0] });
  } catch (err) { next(err); }
};

// PATCH /api/users/me/password
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Mevcut şifre hatalı.' });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hash   = await bcrypt.hash(new_password, rounds);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true, message: 'Şifre güncellendi.' });
  } catch (err) { next(err); }
};

// POST /api/users/reports  — report a listing
const reportListing = async (req, res, next) => {
  try {
    const { listing_id, reason, description } = req.body;
    await query(
      `INSERT INTO reports (listing_id, reporter_id, reason, description)
       VALUES ($1,$2,$3,$4) ON CONFLICT (listing_id, reporter_id) DO NOTHING`,
      [listing_id, req.user.id, reason, description || null]
    );
    res.json({ success: true, message: 'Şikayetiniz alındı.' });
  } catch (err) { next(err); }
};

module.exports = { getMe, getUser, updateMe, changePassword, reportListing };
