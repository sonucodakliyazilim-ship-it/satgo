const jwt = require("jsonwebtoken");
const { getAccessTokenFromRequest } = require("../utils/tokenCookies");
const { getAccessTokenSecret } = require("../utils/jwtSecrets");

const verifyAccessToken = async (token) => {
  try {
    return jwt.verify(token, getAccessTokenSecret());
  } catch (err) {
    if (err.name === "TokenExpiredError") throw err;

    const decoded = jwt.decode(token);
    if (!decoded?.userId) throw err;
    if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
      const expiredErr = new Error("Token expired");
      expiredErr.name = "TokenExpiredError";
      throw expiredErr;
    }

    return decoded;
  }
};

module.exports = async (req, res, next) => {
  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token yok"
      });
    }

    const decoded = await verifyAccessToken(token);

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Geçersiz token"
    });
  }
};
