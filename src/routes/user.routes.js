const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

router.get('/me/profile', authenticate, ctrl.getMe);
router.patch('/me/profile', authenticate, ctrl.updateMe);

router.patch(
  '/me/password',
  [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 8 }),
  ],
  validate,
  authenticate,
  ctrl.changePassword,
);

router.post(
  '/reports',
  [
    body('listing_id').isUUID(),
    body('reason').isIn(['fake', 'spam', 'offensive', 'wrong_category', 'sold', 'other']),
  ],
  validate,
  authenticate,
  ctrl.reportListing,
);

router.get('/:id', ctrl.getUser);

module.exports = router;
