const router = require('express').Router();
const ctrl = require('../controllers/hierarchy.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

router.get('/', ctrl.getHierarchy);

router.post('/', authenticate, requireAdmin, ctrl.createNode);
router.patch('/:id', authenticate, requireAdmin, ctrl.updateNode);
router.delete('/:id', authenticate, requireAdmin, ctrl.deleteNode);
router.post('/import', authenticate, requireAdmin, ctrl.uploadCsv.single('file'), ctrl.importCsv);

module.exports = router;
