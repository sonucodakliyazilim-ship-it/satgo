const jwt = require("jsonwebtoken");
const { getAccessTokenFromRequest } = require("../utils/tokenCookies");
const { findIssuedAccessToken } = require("../utils/tokenStore");

const verifyAccessToken = async (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") throw err;

    const decoded = jwt.decode(token);
    if (!decoded?.userId) throw err;
    if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
      const expiredErr = new Error("Token expired");
      expiredErr.name = "TokenExpiredError";
      throw expiredErr;
    }

    const issued = await findIssuedAccessToken(token);
    if (!issued || issued.user_id !== decoded.userId) throw err;
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
