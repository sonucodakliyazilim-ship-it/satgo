// ── category.routes.js ───────────────────────────────────────
const router = require('express').Router();
const ctrl   = require('../controllers/category.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.get('/',      ctrl.getCategories);
router.get('/:slug', ctrl.getCategory);
router.post('/',     authenticate, requireAdmin, ctrl.createCategory);
router.post('/import', authenticate, requireAdmin, ctrl.uploadCsv.single('file'), ctrl.importCsv);
router.patch('/:id', authenticate, requireAdmin, ctrl.updateCategory);
router.delete('/:id', authenticate, requireAdmin, ctrl.deleteCategory);

module.exports = router;
