const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/listing.controller');
const { authenticate, optionalAuth, requireOwner } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { upload } = require('../controllers/upload.controller');

router.get('/', optionalAuth, ctrl.getListings);

router.get('/me', authenticate, ctrl.getMyListings);

router.get('/home-sections', optionalAuth, ctrl.getHomeSections);

router.get('/user/:userId', ctrl.getUserListings);

router.post('/with-images',
  authenticate,
  upload.array('images', 10),
  ctrl.createListingWithImages,
);

router.get('/:id',
  param('id').isUUID(),
  validate,
  optionalAuth,
  ctrl.getListing,
);

router.post('/',
  authenticate,
  [
    body('category_id').isInt({ min: 1 }).withMessage('Geçerli bir kategori seçin.'),
    body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Başlık 5-200 karakter olmalıdır.'),
    body('price').optional().isNumeric().isFloat({ min: 0 }).withMessage('Geçerli bir fiyat girin.'),
    body('city').notEmpty().withMessage('Şehir seçimi zorunludur.'),
  ],
  validate,
  ctrl.createListing,
);

router.patch('/:id/status',
  authenticate,
  param('id').isUUID(),
  body('status').isIn(['active', 'passive', 'sold']).withMessage('Geçerli bir ilan durumu seçin.'),
  validate,
  ctrl.setListingStatus,
);

router.patch('/:id',
  authenticate,
  param('id').isUUID(),
  validate,
  requireOwner('id'),
  ctrl.updateListing,
);

router.delete('/:id',
  authenticate,
  param('id').isUUID(),
  validate,
  requireOwner('id'),
  ctrl.deleteListing,
);

module.exports = router;
