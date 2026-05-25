const { Pool } = require('pg');

function getDatabaseUrl() {
  const isRailwayRuntime = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID,
  );

  const candidates = isRailwayRuntime
    ? [
        process.env.DATABASE_PRIVATE_URL,
        process.env.RAILWAY_DATABASE_URL,
        process.env.DATABASE_URL,
        process.env.DATABASE_PUBLIC_URL,
        process.env.POSTGRES_URL,
        process.env.POSTGRES_PRISMA_URL,
        process.env.POSTGRES_URL_NON_POOLING,
      ]
    : [
        process.env.DATABASE_URL,
        process.env.DATABASE_PRIVATE_URL,
        process.env.DATABASE_PUBLIC_URL,
        process.env.POSTGRES_URL,
        process.env.POSTGRES_PRISMA_URL,
        process.env.POSTGRES_URL_NON_POOLING,
        process.env.RAILWAY_DATABASE_URL,
      ];

  const directUrl = candidates.find((value) => value && String(value).trim());

  if (directUrl) {
    return String(directUrl).trim();
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
const databaseHost = (() => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
})();
const isRailwayPrivateHost = /(^|\.)railway\.internal$/i.test(databaseHost);
const requiresSsl = hasExplicitSslSetting
  ? ['true', '1', 'yes'].includes(sslSetting)
  : !isRailwayPrivateHost && /railway|rlwy|render|neon|supabase|amazonaws/i.test(databaseUrl);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000),
  keepAlive: true,
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 20000),
  query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 20000),
});

const DB_DEBUG = process.env.DB_DEBUG === 'true';

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

const sanitizeParam = (item) => {
  if (Buffer.isBuffer(item)) return `<Buffer ${item.length} bytes>`;
  if (item instanceof Uint8Array) return `<Uint8Array ${item.byteLength} bytes>`;
  if (Array.isArray(item)) return item.map(sanitizeParam);
  if (item && typeof item === 'object') {
    try {
      return JSON.stringify(item).slice(0, 300);
    } catch {
      return '<Object>';
    }
  }
  return item == null ? item : String(item).slice(0, 300);
};

const sanitizeParams = (params) => (Array.isArray(params) ? params.map(sanitizeParam) : params);

const logQueryError = (err, text, params) => {
  if (err?.code === '42601' || /syntax error/i.test(err?.message || '')) {
    console.error('[db syntax error]', err.message);
    console.error('[db syntax sql]', compactSql(text));
    if (Array.isArray(params)) console.error('[db syntax params]', sanitizeParams(params));
  }
};

const query = async (text, params) => {
  const queryId = ++queryCounter;
  const startTime = Date.now();
  if (DB_DEBUG) console.log('[db.query.start]', queryId, compactSql(text), sanitizeParams(params));
  try {
    return await pool.query(text, params);
  } catch (err) {
    logQueryError(err, text, params);
    console.log('[db.query.error]', queryId, Date.now() - startTime, err.message);
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    if (DB_DEBUG || durationMs > 1000) console.log('[db.query.end]', queryId, durationMs);
  }
};

const getClient = () => pool.connect();

const withTransaction = async (callback) => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  client.query = async (text, params) => {
    const queryId = ++queryCounter;
    const startTime = Date.now();
    if (DB_DEBUG) console.log('[db.client.query.start]', queryId, compactSql(text), sanitizeParams(params));
    try {
      return await originalQuery(text, params);
    } catch (err) {
      logQueryError(err, text, params);
      console.log('[db.client.query.error]', queryId, Date.now() - startTime, err.message);
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;
      if (DB_DEBUG || durationMs > 1000) console.log('[db.client.query.end]', queryId, durationMs);
    }
  };
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db.transaction.rollback.error]', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, getClient, withTransaction };
