const getAccessTokenSecret = () =>
  process.env.JWT_ACCESS_SECRET || process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const getRefreshTokenSecret = () =>
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const assertJwtSecrets = () => {
  if (!getAccessTokenSecret() || !getRefreshTokenSecret()) {
    const err = new Error('JWT secrets are not configured.');
    err.status = 500;
    throw err;
  }
};

module.exports = {
  assertJwtSecrets,
  getAccessTokenSecret,
  getRefreshTokenSecret,
};
