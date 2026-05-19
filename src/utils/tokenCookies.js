const ACCESS_TOKEN_COOKIE = 'accessToken';
const REFRESH_TOKEN_COOKIE = 'refreshToken';

const useCrossSiteCookies = () => {
  const frontendUrl = process.env.FRONTEND_URL || '';
  return process.env.NODE_ENV === 'production' || frontendUrl.includes('https://');
};

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: useCrossSiteCookies(),
  sameSite: useCrossSiteCookies() ? 'none' : 'lax',
  path: '/',
  ...(maxAge ? { maxAge } : {}),
});

const setTokenCookies = (res, accessToken, refreshToken) => {
  if (accessToken) {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(60 * 60 * 1000));
  }

  if (refreshToken) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
  }
};

const clearTokenCookies = (res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions());
};

const getCookie = (req, name) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!target) return null;

  return decodeURIComponent(target.slice(name.length + 1));
};

const getAccessTokenFromRequest = (req) => {
  const sanitize = (t) => {
    if (!t) return null;
    let token = String(t).trim();
    // remove surrounding quotes if present
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      token = token.slice(1, -1);
    }
    // common prefixes
    if (/^Bearer\s+/i.test(token)) token = token.replace(/^Bearer\s+/i, '');
    if (/^Token\s+/i.test(token)) token = token.replace(/^Token\s+/i, '');
    return token.trim();
  };

  const authHeader = req.headers.authorization;
  const fromHeader = sanitize(authHeader);
  if (fromHeader) return fromHeader;

  const fromCookie = getCookie(req, ACCESS_TOKEN_COOKIE);
  return sanitize(fromCookie);
};

const getRefreshTokenFromRequest = (req) => {
  return req.body?.refreshToken || getCookie(req, REFRESH_TOKEN_COOKIE);
};

module.exports = {
  clearTokenCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  setTokenCookies,
};
