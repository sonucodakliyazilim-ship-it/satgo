const router = require('express').Router();
const ctrl   = require('../controllers/admin.controller');
const bannerCtrl = require('../controllers/banner.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

router.get('/dashboard',              ctrl.getDashboard);

router.get('/users',                  ctrl.getUsers);
router.patch('/users/:id/status',     ctrl.setUserStatus);

router.get('/listings',               ctrl.getListings);
router.patch('/listings/:id/status',  ctrl.setListingStatus);
router.delete('/listings/:id',        ctrl.deleteListing);

router.get('/reports',                ctrl.getReports);
router.patch('/reports/:id',          ctrl.resolveReport);

router.get('/payment-settings',       ctrl.getPaymentInfo);
router.patch('/payment-settings',     ctrl.updatePaymentInfo);

router.get('/promotions',             ctrl.getPromotions);
router.get('/promotion-orders',       ctrl.getPromotionOrders);
router.patch('/promotion-orders/:id/approve', ctrl.approveOrder);
router.patch('/promotion-orders/:id/reject',  ctrl.rejectOrder);
router.post('/packages',              ctrl.createPackage);
router.patch('/packages/:id',         ctrl.updatePackage);

router.get('/banners',                bannerCtrl.getAdminBanners);
router.post('/banners',               bannerCtrl.uploadBanner.single('image'), bannerCtrl.createBanner);
router.patch('/banners/:id',          bannerCtrl.uploadBanner.single('image'), bannerCtrl.updateBanner);
router.delete('/banners/:id',         bannerCtrl.deleteBanner);

module.exports = router;
