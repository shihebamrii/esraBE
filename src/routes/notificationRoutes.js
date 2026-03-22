const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

// Public route to get VAPID Key
router.get('/vapid-key', notificationController.getVapidKey);

// Protected routes
router.use(protect);

router.get('/', notificationController.getMyNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.post('/subscribe', notificationController.subscribePush);

module.exports = router;
