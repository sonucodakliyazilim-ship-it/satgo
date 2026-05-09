const { Pool } = require('pg');

function getDatabaseUrl() {
  const directUrl =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.RAILWAY_DATABASE_URL;

  if (directUrl) {
    return directUrl;
  }

  const host = process.env.PGHOST || process.env.POSTGRES_HOST || process.env.DB_HOST;
  const port = process.env.PGPORT || process.env.POSTGRES_PORT || process.env.DB_PORT || '5432';
  const database =
    process.env.PGDATABASE || process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE || process.env.DB_NAME;
  const user = process.env.PGUSER || process.env.POSTGRES_USER || process.env.DB_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD;

  if (host && database && user && password) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  return null;
}

const databaseUrl = getDatabaseUrl();

if (!databaseUrl) {
  throw new Error(
    'Database connection env is missing. Set DATABASE_URL, PGHOST/PGDATABASE/PGUSER/PGPASSWORD, or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.',
  );
}

const requiresSsl =
  process.env.DB_SSL === 'true' ||
  process.env.NODE_ENV === 'production' ||
  /railway|render|neon|supabase|amazonaws/i.test(databaseUrl);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
  process.exit(-1);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, getClient, withTransaction };
