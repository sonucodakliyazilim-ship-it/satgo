const router = require('express').Router();
const ctrl = require('../controllers/customField.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Public read (used by listing form)
router.get('/', ctrl.getCustomFields);

// Admin CRUD
router.get('/admin', authenticate, requireAdmin, ctrl.adminList);
router.post('/admin', authenticate, requireAdmin, ctrl.adminUpsert);
router.delete('/admin/:id', authenticate, requireAdmin, ctrl.adminDelete);

module.exports = router;

