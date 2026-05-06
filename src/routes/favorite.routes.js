const router = require('express').Router();
const ctrl   = require('../controllers/favorite.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate); // all favorites routes require auth

router.get('/',                          ctrl.getFavorites);
router.get('/check/:listingId',          ctrl.checkFavorite);
router.post('/:listingId',               ctrl.addFavorite);
router.delete('/:listingId',             ctrl.removeFavorite);

module.exports = router;
