const { query } = require('../config/database');

const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;

const saveAccessToken = async (userId, token) => {
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_MAX_AGE_MS);
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
};

const findIssuedAccessToken = async (token) => {
  const { rows } = await query(
    `SELECT user_id
     FROM refresh_tokens
     WHERE token = $1
       AND expires_at > NOW()
       AND expires_at <= NOW() + INTERVAL '2 hours'
     LIMIT 1`,
    [token]
  );

  return rows[0] || null;
};

module.exports = { findIssuedAccessToken, saveAccessToken };
