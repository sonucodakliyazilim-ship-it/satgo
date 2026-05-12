const router = require('express').Router();
const ctrl = require('../controllers/hierarchy.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.get('/', ctrl.getHierarchy);
router.get('/group-settings', ctrl.getGroupSettings);

router.post('/', authenticate, requireAdmin, ctrl.createNode);
router.patch('/group-settings', authenticate, requireAdmin, ctrl.updateGroupSettings);
router.patch('/:id', authenticate, requireAdmin, ctrl.updateNode);
router.delete('/:id', authenticate, requireAdmin, ctrl.deleteNode);
router.post('/import', authenticate, requireAdmin, ctrl.uploadCsv.single('file'), ctrl.importCsv);

module.exports = router;
