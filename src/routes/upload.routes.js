const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const { uploadMiddleware, uploadListingImages, getListingImageFile, deleteListingImage, setPrimaryImage } = require('../controllers/upload.controller');

router.get('/listing-images/:imageId/file', getListingImageFile);
router.use(authenticate);

// POST /api/upload/listing-images/:listingId  — upload images for a listing
router.post('/listing-images/:listingId',
  uploadMiddleware('images', 10),
  uploadListingImages
);

// DELETE /api/upload/listing-images/:imageId
router.delete('/listing-images/:imageId', deleteListingImage);

// PATCH /api/upload/listing-images/:imageId/primary
router.patch('/listing-images/:imageId/primary', setPrimaryImage);

module.exports = router;
