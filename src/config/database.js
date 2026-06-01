const { Pool } = require('pg');

function pushUrlCandidate(candidates, source, value) {
  const url = String(value || '').trim();
  if (!url || candidates.some((item) => item.url === url)) return;
  candidates.push({ source, url });
}

function getDatabaseCandidates() {
  const isRailwayRuntime = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID,
  );

  const candidateNames = isRailwayRuntime
    ? [
        'DATABASE_PUBLIC_URL',
        'POSTGRES_URL',
        'POSTGRES_PRISMA_URL',
        'POSTGRES_URL_NON_POOLING',
        'DATABASE_URL',
        'DATABASE_PRIVATE_URL',
        'RAILWAY_DATABASE_URL',
      ]
    : [
        'DATABASE_URL',
        'DATABASE_PRIVATE_URL',
        'DATABASE_PUBLIC_URL',
        'POSTGRES_URL',
        'POSTGRES_PRISMA_URL',
        'POSTGRES_URL_NON_POOLING',
        'RAILWAY_DATABASE_URL',
      ];

  const candidates = [];
  candidateNames.forEach((name) => pushUrlCandidate(candidates, name, process.env[name]));

  const host = process.env.PGHOST || process.env.POSTGRES_HOST || process.env.DB_HOST;
  const port = process.env.PGPORT || process.env.POSTGRES_PORT || process.env.DB_PORT || '5432';
  const database =
    process.env.PGDATABASE || process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE || process.env.DB_NAME;
  const user = process.env.PGUSER || process.env.POSTGRES_USER || process.env.DB_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD;

  if (host && database && user && password) {
    pushUrlCandidate(
      candidates,
      'PGHOST/DB_HOST',
      `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
    );
  }

  return candidates;
}

const databaseCandidates = getDatabaseCandidates();

if (!databaseCandidates.length) {
  throw new Error(
    'Database connection env is missing. Set DATABASE_URL, PGHOST/PGDATABASE/PGUSER/PGPASSWORD, or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.',
  );
}

const sslSetting = String(process.env.DB_SSL || '').trim().toLowerCase();
const hasExplicitSslSetting = ['true', '1', 'yes', 'false', '0', 'no'].includes(sslSetting);

const getDatabaseHost = (databaseUrl) => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
};

const requiresSslForUrl = (databaseUrl) => {
  const databaseHost = getDatabaseHost(databaseUrl);
  const isRailwayPrivateHost = /(^|\.)railway\.internal$/i.test(databaseHost);
  const publicManagedHost =
    !isRailwayPrivateHost && /railway|rlwy|render|neon|supabase|amazonaws/i.test(databaseUrl);
  if (hasExplicitSslSetting) {
    const explicitlyEnabled = ['true', '1', 'yes'].includes(sslSetting);
    return explicitlyEnabled || publicManagedHost;
  }
  return publicManagedHost;
};

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const DB_CONNECT_TIMEOUT_MS = Math.min(numberFromEnv('PG_CONNECTION_TIMEOUT_MS', 2500), 4000);
const DB_POOL_MAX = Math.min(numberFromEnv('PGPOOL_MAX', 4), 5);
const DB_QUERY_RETRIES = Math.min(numberFromEnv('PG_QUERY_RETRIES', 2), 3);

const poolOptionsForUrl = (databaseUrl) => ({
  connectionString: databaseUrl,
  ssl: requiresSslForUrl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  max: DB_POOL_MAX,
  idleTimeoutMillis: numberFromEnv('PG_IDLE_TIMEOUT_MS', 10000),
  connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
  keepAlive: true,
  maxUses: numberFromEnv('PG_MAX_USES', 750),
  application_name: process.env.PGAPPNAME || 'satgo-api',
  statement_timeout: numberFromEnv('PG_STATEMENT_TIMEOUT_MS', 20000),
  query_timeout: numberFromEnv('PG_QUERY_TIMEOUT_MS', 20000),
});

const DB_DEBUG = process.env.DB_DEBUG === 'true';

const makePoolLabel = ({ source, url }) => {
  const host = getDatabaseHost(url);
  return host ? `${source} (${host})` : source;
};

const attachPoolErrorHandler = (entry) => {
  entry.pool.on('error', (err) => {
    console.error(`[db.pool.error] ${entry.label}:`, err.code || err.message);
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error('DB connection lost. Verify database is running.');
    }
  });
};

const createPoolEntry = (candidate) => {
  const entry = {
    source: candidate.source,
    url: candidate.url,
    label: makePoolLabel(candidate),
    pool: new Pool(poolOptionsForUrl(candidate.url)),
  };
  attachPoolErrorHandler(entry);
  return entry;
};

let poolEntries = databaseCandidates.map(createPoolEntry);
let activePoolIndex = 0;

const resetPoolEntry = (index, reason) => {
  const current = poolEntries[index];
  if (!current) return;
  console.warn(`[db.pool.reset] ${current.label}:`, reason?.code || reason?.message || reason);
  const oldPool = current.pool;
  poolEntries[index] = createPoolEntry(current);
  oldPool.end().catch((err) => {
    console.warn(`[db.pool.reset.end.failed] ${current.label}:`, err.message);
  });
};

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

const CONNECTION_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNABORTED',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '57P01',
  '57P03',
  '53300',
]);

const isConnectionFailure = (err) => {
  const message = err?.message || '';
  return (
    CONNECTION_ERROR_CODES.has(err?.code) ||
    /timeout exceeded when trying to connect|connection terminated|connect ETIMEDOUT|getaddrinfo|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|too many clients|remaining connection slots/i.test(message)
  );
};

const getCandidateOrder = () => [
  activePoolIndex,
  ...poolEntries.map((_, index) => index).filter((index) => index !== activePoolIndex),
];

const runWithPoolFallback = async (action, operation) => {
  let lastError;

  for (const index of getCandidateOrder()) {
    const entry = poolEntries[index];
    try {
      const result = await operation(entry.pool, entry);
      if (index !== activePoolIndex) {
        console.warn(`[db.fallback.active] switched to ${entry.label}`);
      }
      activePoolIndex = index;
      return result;
    } catch (err) {
      lastError = err;
      if (isConnectionFailure(err)) {
        resetPoolEntry(index, err);
      }
      if (!isConnectionFailure(err) || poolEntries.length === 1) {
        throw err;
      }
      console.warn(`[db.fallback.${action}.failed] ${entry.label}:`, err.code || err.message);
    }
  }

  throw lastError;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithPoolRetry = async (action, operation) => {
  let lastError;

  for (let attempt = 0; attempt <= DB_QUERY_RETRIES; attempt += 1) {
    try {
      return await runWithPoolFallback(action, operation);
    } catch (err) {
      lastError = err;
      if (!isConnectionFailure(err) || attempt >= DB_QUERY_RETRIES) {
        throw err;
      }
      const delayMs = 150 * (attempt + 1);
      console.warn(`[db.retry.${action}] attempt=${attempt + 1} delayMs=${delayMs}:`, err.code || err.message);
      await sleep(delayMs);
    }
  }

  throw lastError;
};

const pool = {
  query: (text, params) => runWithPoolRetry('query', (pgPool) => pgPool.query(text, params)),
  connect: () => runWithPoolRetry('connect', (pgPool) => pgPool.connect()),
  end: async () => {
    const results = await Promise.allSettled(poolEntries.map((entry) => entry.pool.end()));
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected) throw rejected.reason;
  },
  get totalCount() {
    return poolEntries.reduce((sum, entry) => sum + entry.pool.totalCount, 0);
  },
  get idleCount() {
    return poolEntries.reduce((sum, entry) => sum + entry.pool.idleCount, 0);
  },
  get waitingCount() {
    return poolEntries.reduce((sum, entry) => sum + entry.pool.waitingCount, 0);
  },
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
