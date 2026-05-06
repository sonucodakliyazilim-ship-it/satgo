const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

router.use(authenticate);

router.get('/conversations', ctrl.getConversations);

router.get('/conversations/:conversationId', ctrl.getMessages);

router.post('/',
  [
    body('listing_id').optional({ checkFalsy: true }).isUUID().withMessage('Geçerli bir ilan ID girin.'),
    body('conversation_id').optional({ checkFalsy: true }).isUUID().withMessage('Geçerli bir konuşma ID girin.'),
    body().custom((_, { req }) => {
      if (!req.body.listing_id && !req.body.conversation_id) {
        throw new Error('Mesaj için ilan veya konuşma seçilmelidir.');
      }
      return true;
    }),
    body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Mesaj 1-2000 karakter olmalıdır.'),
  ],
  validate,
  ctrl.sendMessage,
);

router.delete('/:messageId', ctrl.deleteMessage);

module.exports = router;
