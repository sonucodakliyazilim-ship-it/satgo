const router = require('express').Router();
const authRoutes = require('./auth.routes');

router.post("/login", async (req, res) => {
  res.json({ message: "login çalışıyor" });
});

router.use(authRoutes);

module.exports = router;
