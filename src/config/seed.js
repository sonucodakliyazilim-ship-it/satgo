require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('./database');

const required = ['ADMIN_EMAIL', 'ADMIN_PASSWORD'];

async function seedAdmin() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env value(s): ${missing.join(', ')}`);
  }

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || 'Satgo Admin').trim();
  const password = process.env.ADMIN_PASSWORD;
  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const passwordHash = await bcrypt.hash(password, rounds);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, status, email_verified)
     VALUES ($1, $2, $3, 'admin', 'active', TRUE)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       status = 'active',
       email_verified = TRUE,
       updated_at = NOW()
     RETURNING id, name, email, role, status`,
    [name, email, passwordHash],
  );

  console.log(`Admin ready: ${rows[0].email}`);
}

seedAdmin()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err.message);
    await pool.end();
    process.exit(1);
  });
