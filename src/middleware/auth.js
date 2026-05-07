const jwt = require("jsonwebtoken");
const { getAccessTokenFromRequest } = require("../utils/tokenCookies");

module.exports = (req, res, next) => {
  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token yok"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Geçersiz token"
    });
  }
};
