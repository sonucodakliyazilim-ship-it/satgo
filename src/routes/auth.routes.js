const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');

const passwordRules = body('password')
  .isLength({ min: 6 })
  .withMessage('Şifre en az 6 karakter olmalıdır.');

router.post(
  '/register',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('İsim 2-100 karakter olmalıdır.'),

    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Geçerli bir e-posta girin.'),

    passwordRules,

    body('phone')
      .optional({ checkFalsy: true })
      .matches(/^05[0-9]{9}$/)
      .withMessage('Telefon 05XXXXXXXXX formatında olmalıdır.'),
  ],
  validate,
  ctrl.register,
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Geçerli bir e-posta girin.'),
    body('password').notEmpty().withMessage('Şifre gerekli.'),
  ],
  validate,
  ctrl.login,
);

router.post(
  '/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token gerekli.'),
  ],
  validate,
  ctrl.refresh,
);

router.post('/logout', ctrl.logout);

router.post(
  '/forgot-password',
  [
    body('email').isEmail().normalizeEmail().withMessage('Geçerli bir e-posta girin.'),
  ],
  validate,
  ctrl.forgotPassword,
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token gerekli.'),
    passwordRules,
  ],
  validate,
  ctrl.resetPassword,
);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Mevcut şifre gerekli.'),
    passwordRules,
  ],
  validate,
  ctrl.changePassword,
);

module.exports = router;
