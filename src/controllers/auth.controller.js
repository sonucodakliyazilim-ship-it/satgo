const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const { clearTokenCookies, getRefreshTokenFromRequest, setTokenCookies } = require('../utils/tokenCookies');
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

const persistRefreshToken = (userId, token) => {
  saveRefreshToken(userId, token).catch((err) => {
    console.log('[auth] refresh token save skipped', err.message);
  });
};

const recordLastLogin = (userId) => {
  query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]).catch((err) => {
    console.log('[login] last_login update skipped', err.message);
  });
};

const AUTH_SCHEMA_ENSURE_ON_REQUEST = process.env.AUTH_SCHEMA_ENSURE === 'true';

const authPerfStart = (scope, step, requestStart, extra = {}) => {
  console.log(`[perf] auth.${scope}.${step}.start`, {
    totalMs: Date.now() - requestStart,
    ...extra,
  });
  return Date.now();
};

const authPerfEnd = (scope, step, started, requestStart, extra = {}) => {
  console.log(`[perf] auth.${scope}.${step}.end`, {
    durationMs: Date.now() - started,
    totalMs: Date.now() - requestStart,
    ...extra,
  });
};

const getFrontendBaseUrl = () =>
  (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://satgo.vercel.app'
  ).split(',')[0].trim().replace(/\/$/, '');

const getPasswordResetUrl = (token) =>
  `${getFrontendBaseUrl()}/sifre-yenile?token=${encodeURIComponent(token)}`;

let authSchemaPromise = null;

const ensureAuthSchema = () => {
  if (!authSchemaPromise) {
    authSchemaPromise = (async () => {
      console.log('[ensureAuthSchema] start');
      try {
        await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('[ensureAuthSchema] uuid extension ok');

        await query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
              CREATE TYPE user_role AS ENUM ('user', 'admin');
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
              CREATE TYPE user_status AS ENUM ('active', 'banned', 'pending');
            END IF;
          END $$;
        `);
        console.log('[ensureAuthSchema] types ok');

        await query(`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(20),
            password_hash TEXT NOT NULL,
            avatar_url TEXT,
            bio TEXT,
            role user_role NOT NULL DEFAULT 'user',
            status user_status NOT NULL DEFAULT 'active',
            city VARCHAR(100),
            district VARCHAR(100),
            email_verified BOOLEAN DEFAULT FALSE,
            phone_verified BOOLEAN DEFAULT FALSE,
            email_verify_token TEXT,
            phone_verify_code VARCHAR(6),
            reset_token TEXT,
            reset_token_expires TIMESTAMPTZ,
            rating_avg NUMERIC(3,2) DEFAULT 0,
            rating_count INTEGER DEFAULT 0,
            listing_count INTEGER DEFAULT 0,
            last_login_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        console.log('[ensureAuthSchema] users table ok');

        await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        console.log('[ensureAuthSchema] users index ok');

        await query(`
          CREATE TABLE IF NOT EXISTS refresh_tokens (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        console.log('[ensureAuthSchema] refresh_tokens table ok');

        console.log('[ensureAuthSchema] done');
      } catch (err) {
        console.log('[ensureAuthSchema] error', err.message);
        throw err;
      }
    })().catch((err) => {
      authSchemaPromise = null;
      throw err;
    });
  }

  return authSchemaPromise;
};

const ensureAuthSchemaForRequest = () =>
  AUTH_SCHEMA_ENSURE_ON_REQUEST ? ensureAuthSchema() : Promise.resolve();

const OAUTH_STATE_COOKIE = 'satgo_oauth_state';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

const getCookieValue = (req, name) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
};

const useSecureCookies = () => {
  const frontendUrl = process.env.FRONTEND_URL || '';
  return process.env.NODE_ENV === 'production' || frontendUrl.includes('https://');
};

const oauthCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: useSecureCookies(),
  sameSite: useSecureCookies() ? 'none' : 'lax',
  path: '/api/auth/oauth',
  ...(maxAge ? { maxAge } : {}),
});

const clearOAuthStateCookie = (res) => {
  res.clearCookie(OAUTH_STATE_COOKIE, oauthCookieOptions());
};

const normalizeReturnTo = (value = '/') => {
  try {
    const frontend = new URL(getFrontendBaseUrl());
    const candidate = new URL(value || '/', frontend);
    if (candidate.origin !== frontend.origin) return '/';
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return '/';
  }
};

const buildFrontendRedirect = (returnTo = '/', params = {}) => {
  const url = new URL(normalizeReturnTo(returnTo), getFrontendBaseUrl());
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const redirectOAuthFailure = (res, message, returnTo = '/giris') => {
  clearOAuthStateCookie(res);
  return res.redirect(buildFrontendRedirect(returnTo, {
    oauth: 'error',
    message: message || 'Sosyal giriş tamamlanamadı.',
  }));
};

const getOAuthStateSecret = () => {
  assertJwtSecrets();
  return process.env.OAUTH_STATE_SECRET || getRefreshTokenSecret() || getAccessTokenSecret();
};

const signStatePayload = (payload) =>
  crypto.createHmac('sha256', getOAuthStateSecret()).update(payload).digest('base64url');

const createOAuthState = (provider, returnTo) => {
  const payload = Buffer.from(JSON.stringify({
    provider,
    returnTo: normalizeReturnTo(returnTo),
    nonce: crypto.randomBytes(24).toString('hex'),
    createdAt: Date.now(),
  })).toString('base64url');

  return `${payload}.${signStatePayload(payload)}`;
};

const verifyOAuthState = (req, provider) => {
  const state = String(req.query.state || '');
  const stateCookie = getCookieValue(req, OAUTH_STATE_COOKIE);
  if (!state || !stateCookie || state !== stateCookie) {
    throw Object.assign(new Error('Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.'), { status: 400 });
  }

  const [payload, signature] = state.split('.');
  if (!payload || !signature) {
    throw Object.assign(new Error('OAuth state formatı geçersiz.'), { status: 400 });
  }

  const expected = signStatePayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw Object.assign(new Error('OAuth state imzası geçersiz.'), { status: 400 });
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (data.provider !== provider) {
    throw Object.assign(new Error('OAuth sağlayıcısı eşleşmedi.'), { status: 400 });
  }
  if (!data.createdAt || Date.now() - data.createdAt > OAUTH_STATE_MAX_AGE_MS) {
    throw Object.assign(new Error('OAuth oturumunun süresi doldu. Lütfen tekrar deneyin.'), { status: 400 });
  }

  return data;
};

const getRequestBaseUrl = (req) => {
  const configured =
    process.env.BACKEND_URL ||
    process.env.API_BASE_URL ||
    (process.env.API_URL || '').replace(/\/api\/?$/, '');

  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

const getOAuthCallbackUrl = (req, provider) => {
  if (provider === 'google' && process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  if (provider === 'github' && process.env.GITHUB_REDIRECT_URI) {
    return process.env.GITHUB_REDIRECT_URI;
  }

  return `${getRequestBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
};

const facebookGraphVersion = () => process.env.FACEBOOK_GRAPH_VERSION || 'v22.0';

const OAUTH_PROVIDERS = {
  google: {
    displayName: 'Google',
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    extraAuthParams: { access_type: 'online', prompt: 'select_account' },
  },
  facebook: {
    displayName: 'Facebook',
    clientId: () => process.env.FACEBOOK_CLIENT_ID,
    clientSecret: () => process.env.FACEBOOK_CLIENT_SECRET,
    authUrl: () => `https://www.facebook.com/${facebookGraphVersion()}/dialog/oauth`,
    tokenUrl: () => `https://graph.facebook.com/${facebookGraphVersion()}/oauth/access_token`,
    scope: 'email,public_profile',
    extraAuthParams: {},
  },
  github: {
    displayName: 'GitHub',
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    authUrl: () => 'https://github.com/login/oauth/authorize',
    tokenUrl: () => 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    extraAuthParams: { allow_signup: 'true' },
  },
};

const getOAuthProvider = (providerName) => {
  const provider = String(providerName || '').toLowerCase();
  const config = OAUTH_PROVIDERS[provider];
  return config ? { key: provider, ...config } : null;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const detail = data.error_description || data.error?.message || data.error || data.raw;
    throw Object.assign(new Error(detail || 'OAuth sağlayıcısı isteği reddetti.'), { status: 502 });
  }

  return data;
};

const exchangeOAuthCode = async (provider, code, redirectUri) => {
  const body = new URLSearchParams({
    code,
    client_id: provider.clientId(),
    client_secret: provider.clientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  if (provider.key === 'facebook') {
    const url = new URL(provider.tokenUrl());
    body.forEach((value, key) => url.searchParams.set(key, value));
    return fetchJson(url.toString());
  }

  if (provider.key === 'github') {
    return fetchJson(provider.tokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
  }

  return fetchJson(provider.tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
};

const fetchOAuthProfile = async (provider, tokens) => {
  const accessToken = tokens.access_token;
  if (!accessToken) {
    throw Object.assign(new Error('OAuth access token alınamadı.'), { status: 502 });
  }

  if (provider.key === 'google') {
    const profile = await fetchJson('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      provider_user_id: profile.sub,
      email: profile.email,
      email_verified: Boolean(profile.email_verified),
      name: profile.name || profile.email?.split('@')[0] || 'Google Kullanıcısı',
      avatar_url: profile.picture || null,
      raw: profile,
    };
  }

  if (provider.key === 'github') {
    const profile = await fetchJson('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'satgo-app',
      },
    });

    let email = profile.email;
    let email_verified = Boolean(email);

    if (!email) {
      const emailList = await fetchJson('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'satgo-app',
        },
      });

      if (Array.isArray(emailList)) {
        const primary = emailList.find((item) => item.primary && item.verified);
        const verified = emailList.find((item) => item.verified);
        email = primary?.email || verified?.email || email;
        email_verified = Boolean(primary?.verified || verified?.verified);
      }
    }

    return {
      provider_user_id: String(profile.id),
      email,
      email_verified,
      name: profile.name || profile.login || 'GitHub Kullanıcısı',
      avatar_url: profile.avatar_url || null,
      raw: { ...profile },
    };
  }

  const url = new URL(`https://graph.facebook.com/${facebookGraphVersion()}/me`);
  url.searchParams.set('fields', 'id,name,email,picture.type(large)');
  url.searchParams.set('access_token', accessToken);

  const clientSecret = provider.clientSecret();
  if (clientSecret) {
    url.searchParams.set(
      'appsecret_proof',
      crypto.createHmac('sha256', clientSecret).update(accessToken).digest('hex'),
    );
  }

  const profile = await fetchJson(url.toString());
  return {
    provider_user_id: profile.id,
    email: profile.email,
    email_verified: Boolean(profile.email),
    name: profile.name || profile.email?.split('@')[0] || 'Facebook Kullanıcısı',
    avatar_url: profile.picture?.data?.url || null,
    raw: profile,
  };
};

let oauthSchemaPromise = null;

const ensureOAuthSchema = () => {
  if (!oauthSchemaPromise) {
    oauthSchemaPromise = (async () => {
      await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await query(`
        DO $$
        DECLARE
          user_id_type text;
        BEGIN
          SELECT format_type(a.atttypid, a.atttypmod)
          INTO user_id_type
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'users'
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped;

          IF user_id_type IS NULL THEN
            RAISE EXCEPTION 'users.id column is required before oauth schema can run';
          END IF;

          EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS oauth_accounts (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              provider VARCHAR(30) NOT NULL,
              provider_user_id TEXT NOT NULL,
              provider_email VARCHAR(255),
              profile JSONB NOT NULL DEFAULT '{}'::jsonb,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(provider, provider_user_id)
            )
          $sql$, user_id_type);
        END $$;
      `);
      await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ');
      await query('ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS provider_email VARCHAR(255)');
      await query("ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb");
      await query('ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      await query('ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_accounts_provider_user ON oauth_accounts(provider, provider_user_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email ON oauth_accounts(provider_email)');
    })().catch((err) => {
      oauthSchemaPromise = null;
      throw err;
    });
  }

  return oauthSchemaPromise;
};

const findOrCreateOAuthUser = async (provider, profile) => {
  if (!profile.provider_user_id) {
    throw Object.assign(new Error('OAuth profil kimliği alınamadı.'), { status: 502 });
  }

  const normalizedEmail = profile.email ? String(profile.email).trim().toLowerCase() : null;

  await ensureAuthSchemaForRequest();
  await ensureOAuthSchema();

  return withTransaction(async (client) => {
    const account = await client.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.avatar_url, u.city, u.district, u.email_verified, u.created_at
       FROM oauth_accounts oa
       JOIN users u ON u.id = oa.user_id
       WHERE oa.provider = $1 AND oa.provider_user_id = $2`,
      [provider.key, profile.provider_user_id],
    );

    let user = account.rows[0] || null;

    if (!user && normalizedEmail) {
      const existing = await client.query(
        `SELECT id, name, email, role, status, avatar_url, city, district, email_verified, created_at
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [normalizedEmail],
      );
      user = existing.rows[0] || null;
    }

    if (!user) {
      if (!normalizedEmail) {
        throw Object.assign(
          new Error(`${provider.displayName} hesabından e-posta alınamadı. Lütfen e-posta izni vererek tekrar deneyin.`),
          { status: 400 },
        );
      }

      const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(`oauth:${provider.key}:${profile.provider_user_id}:${uuidv4()}`, rounds);
      const inserted = await client.query(
        `INSERT INTO users (name, email, password_hash, avatar_url, email_verified, last_login_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         RETURNING id, name, email, role, status, avatar_url, city, district, email_verified, created_at`,
        [
          profile.name || normalizedEmail.split('@')[0],
          normalizedEmail,
          passwordHash,
          profile.avatar_url || null,
          Boolean(profile.email_verified),
        ],
      );
      user = inserted.rows[0];
    }

    if (user.status === 'banned') {
      throw Object.assign(new Error('Hesabınız engellenmiştir.'), { status: 403 });
    }

    await client.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email, profile)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (provider, provider_user_id)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         provider_email = EXCLUDED.provider_email,
         profile = EXCLUDED.profile,
         updated_at = NOW()`,
      [user.id, provider.key, profile.provider_user_id, normalizedEmail, JSON.stringify(profile.raw || {})],
    );

    const updated = await client.query(
      `UPDATE users
       SET
         last_login_at = NOW(),
         avatar_url = COALESCE(NULLIF(avatar_url, ''), $2),
         email_verified = CASE WHEN $3 THEN TRUE ELSE email_verified END
       WHERE id = $1
       RETURNING id, name, email, role, status, avatar_url, city, district, email_verified, created_at`,
      [user.id, profile.avatar_url || null, Boolean(profile.email_verified)],
    );

    return updated.rows[0];
  });
};

// ── Controllers ───────────────────────────────────────────────

// GET /api/auth/oauth/:provider/start
const startOAuth = async (req, res) => {
  const provider = getOAuthProvider(req.params.provider);
  if (!provider) {
    return redirectOAuthFailure(res, 'Desteklenmeyen sosyal giriş sağlayıcısı.');
  }

  if (!provider.clientId() || !provider.clientSecret()) {
    return redirectOAuthFailure(res, `${provider.displayName} girişi henüz yapılandırılmadı.`);
  }

  try {
    const returnTo = normalizeReturnTo(req.query.redirect || req.query.returnTo || '/');
    const state = createOAuthState(provider.key, returnTo);
    const redirectUri = getOAuthCallbackUrl(req, provider.key);
    const authUrl = new URL(provider.authUrl());

    authUrl.searchParams.set('client_id', provider.clientId());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', provider.scope);
    authUrl.searchParams.set('state', state);

    Object.entries(provider.extraAuthParams || {}).forEach(([key, value]) => {
      authUrl.searchParams.set(key, value);
    });

    res.cookie(OAUTH_STATE_COOKIE, state, oauthCookieOptions(OAUTH_STATE_MAX_AGE_MS));
    return res.redirect(authUrl.toString());
  } catch (err) {
    return redirectOAuthFailure(res, err.message);
  }
};

// GET /api/auth/oauth/:provider/callback
const handleOAuthCallback = async (req, res) => {
  const provider = getOAuthProvider(req.params.provider);
  if (!provider) {
    return redirectOAuthFailure(res, 'Desteklenmeyen sosyal giriş sağlayıcısı.');
  }

  let stateData = null;

  try {
    if (req.query.error) {
      return redirectOAuthFailure(
        res,
        req.query.error_description || req.query.error_message || req.query.error,
      );
    }

    stateData = verifyOAuthState(req, provider.key);
    clearOAuthStateCookie(res);

    const code = String(req.query.code || '');
    if (!code) {
      return redirectOAuthFailure(res, 'OAuth doğrulama kodu alınamadı.', stateData.returnTo);
    }

    const redirectUri = getOAuthCallbackUrl(req, provider.key);
    const tokens = await exchangeOAuthCode(provider, code, redirectUri);
    const profile = await fetchOAuthProfile(provider, tokens);
    const user = await findOrCreateOAuthUser(provider, profile);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    persistRefreshToken(user.id, refreshToken);
    recordLastLogin(user.id);
    setTokenCookies(res, accessToken, refreshToken);

    return res.redirect(buildFrontendRedirect(stateData.returnTo || '/', { oauth: 'success' }));
  } catch (err) {
    return redirectOAuthFailure(res, err.message, stateData?.returnTo || '/giris');
  }
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    console.log('[perf] auth.register.start', { email: req.body?.email, contentType: req.headers['content-type'] });
    await ensureAuthSchemaForRequest();
    const { name, email, password, phone, city } = req.body;
    console.log('[register] fields name=', name, 'email=', email, 'phone=', phone);

    // Check existing email
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    console.log('[register] email check existing=', existing.rows.length);
    if (existing.rows.length) {
      console.log('[register] email duplicate');
      return res.status(409).json({ success: false, message: 'Bu e-posta adresi zaten kayıtlı.' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    console.log('[register] hash start');
    const passwordHash = await bcrypt.hash(password, rounds);
    console.log('[register] hash done');
    const verifyToken = uuidv4();

    let rows;
    try {
      const result = await query(
        `INSERT INTO users (name, email, phone, password_hash, city, email_verify_token)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, email, role, status, created_at`,
        [name, email, phone || null, passwordHash, city || null, verifyToken]
      );
      rows = result.rows;
    } catch (err) {
      if (err.code !== '42703') throw err;
      console.log('[register] optional user column missing, retrying minimal insert');
      const result = await query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, role, status, created_at`,
        [name, email, passwordHash]
      );
      rows = result.rows;
    }
    console.log('[register] insert done rows=', rows.length);

    const user = rows[0];
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    persistRefreshToken(user.id, refreshToken);
    recordLastLogin(user.id);
    setTokenCookies(res, accessToken, refreshToken);

    // TODO: send verification email here

    res.status(201).json({
      success: true,
      message: 'Kayıt başarılı.',
      data: { user, accessToken, refreshToken },
    });
  } catch (err) {
    console.log('[register] error', err.message, 'code=', err.code, 'constraint=', err.constraint);
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  const requestStart = Date.now();
  const scope = 'login';
  try {
    console.log('[perf] auth.login.start', { email: req.body?.email });
    const schemaStarted = authPerfStart(scope, 'schema_ensure', requestStart, { enabled: AUTH_SCHEMA_ENSURE_ON_REQUEST });
    await ensureAuthSchemaForRequest();
    authPerfEnd(scope, 'schema_ensure', schemaStarted, requestStart);
    const { email, password } = req.body;
    console.log('[login] email=', email);

    const lookupStarted = authPerfStart(scope, 'user_lookup', requestStart, { email });
    const { rows } = await query(
      `SELECT id, name, email, role, status, created_at, password_hash
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );
    authPerfEnd(scope, 'user_lookup', lookupStarted, requestStart, { found: rows.length });
    console.log('[login] query done found=', rows.length);

    if (!rows.length) {
      console.log('[login] user not found');
      return res.status(401).json({ success: false, message: 'E-posta veya şifre hatalı.' });
    }

    const user = rows[0];

    if (user.status === 'banned') {
      console.log('[login] user banned');
      return res.status(403).json({ success: false, message: 'Hesabınız engellenmiştir.' });
    }

    const passwordStarted = authPerfStart(scope, 'password_compare', requestStart, { userId: user.id });
    const valid = await bcrypt.compare(password, user.password_hash);
    authPerfEnd(scope, 'password_compare', passwordStarted, requestStart, { userId: user.id, valid });
    console.log('[login] password valid=', valid);
    if (!valid) {
      console.log('[login] password mismatch');
      return res.status(401).json({ success: false, message: 'E-posta veya şifre hatalı.' });
    }

    const tokenGenerateStarted = authPerfStart(scope, 'token_generate', requestStart, { userId: user.id });
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    authPerfEnd(scope, 'token_generate', tokenGenerateStarted, requestStart, { userId: user.id });

    const tokenStoreStarted = authPerfStart(scope, 'token_store', requestStart, { userId: user.id });
    persistRefreshToken(user.id, refreshToken);
    recordLastLogin(user.id);
    authPerfEnd(scope, 'token_store', tokenStoreStarted, requestStart, { userId: user.id });
    setTokenCookies(res, accessToken, refreshToken);
    delete user.password_hash;

    const responseStarted = authPerfStart(scope, 'response_send', requestStart, { userId: user.id });
    res.json({
      success: true,
      data: { user, accessToken, refreshToken },
    });
    authPerfEnd(scope, 'response_send', responseStarted, requestStart, { userId: user.id });
    console.log('[perf] auth.login.end', { userId: user.id, totalMs: Date.now() - requestStart });
    return;
  } catch (err) {
    console.log('[perf] auth.login.error', { totalMs: Date.now() - requestStart, message: err.message });
    next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    await ensureAuthSchemaForRequest();
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
    persistRefreshToken(decoded.userId, newRefresh);
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
    await ensureAuthSchemaForRequest();
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
    await ensureAuthSchemaForRequest();
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
    await ensureAuthSchemaForRequest();
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
    await ensureAuthSchemaForRequest();
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
  startOAuth,
  handleOAuthCallback,
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
