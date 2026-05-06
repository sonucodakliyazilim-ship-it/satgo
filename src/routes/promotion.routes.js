const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/promotion.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

router.get('/packages', ctrl.getPackages);

// Online payment is intentionally disabled for now.
router.post('/webhook', ctrl.handleWebhook);

router.use(authenticate);

router.get('/my', ctrl.getMyPromotions);

router.get('/orders/:id',
  param('id').isUUID().withMessage('Geçerli bir ödeme kaydı ID girin.'),
  validate,
  ctrl.getOrder,
);

router.post('/purchase',
  [
    body('listing_id').isUUID().withMessage('Geçerli bir ilan ID girin.'),
    body('package_id').isInt({ min: 1 }).withMessage('Geçerli bir paket seçin.'),
    body('user_note').optional({ nullable: true }).trim().isLength({ max: 500 }),
  ],
  validate,
  ctrl.purchasePromotion,
);

module.exports = router;
