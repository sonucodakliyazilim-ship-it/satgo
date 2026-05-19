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

const sslSetting = String(process.env.DB_SSL || '').trim().toLowerCase();
const hasExplicitSslSetting = ['true', '1', 'yes', 'false', '0', 'no'].includes(sslSetting);
const requiresSsl = hasExplicitSslSetting
  ? ['true', '1', 'yes'].includes(sslSetting)
  : /railway|render|neon|supabase|amazonaws/i.test(databaseUrl);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.code || err.message);
  // Do not exit immediately; allow graceful handling. Errors from idle connections
  // or pool lifecycle should not terminate the server.
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    console.error('DB connection lost. Verify database is running.');
  }
});

const compactSql = (text) =>
  typeof text === 'string'
    ? text.replace(/\s+/g, ' ').trim().slice(0, 700)
    : String(text || '').slice(0, 700);
let queryCounter = 0;

const logQueryError = (err, text, params) => {
  if (err?.code === '42601' || /syntax error/i.test(err?.message || '')) {
    console.error('[db syntax error]', err.message);
    console.error('[db syntax sql]', compactSql(text));
    if (Array.isArray(params)) console.error('[db syntax params]', params.map((item) => (item == null ? item : String(item).slice(0, 80))));
  }
};

const query = async (text, params) => {
  const queryId = ++queryCounter;
  const startTime = Date.now();
  console.log('[db.query.start]', queryId, compactSql(text), params);
  try {
    return await pool.query(text, params);
  } catch (err) {
    logQueryError(err, text, params);
    console.log('[db.query.error]', queryId, Date.now() - startTime, err.message);
    throw err;
  } finally {
    console.log('[db.query.end]', queryId, Date.now() - startTime);
  }
};

const getClient = () => pool.connect();

const withTransaction = async (callback) => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  client.query = async (text, params) => {
    const queryId = ++queryCounter;
    const startTime = Date.now();
    console.log('[db.client.query.start]', queryId, compactSql(text), params);
    try {
      return await originalQuery(text, params);
    } catch (err) {
      logQueryError(err, text, params);
      console.log('[db.client.query.error]', queryId, Date.now() - startTime, err.message);
      throw err;
    } finally {
      console.log('[db.client.query.end]', queryId, Date.now() - startTime);
    }
  };
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
