const asyncHandler = require('../utils/asyncHandler');
const { Notification, PushSubscription } = require('../models');

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
const getMyNotifications = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Notification.countDocuments({ recipient: req.user._id });
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

  res.status(200).json({
    status: 'success',
    data: { notifications, total, unreadCount, page, pages: Math.ceil(total / limit) }
  });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    data: { notification }
  });
});

/**
 * @desc    Get VAPID Public Key for client
 * @route   GET /api/notifications/vapid-key
 * @access  Public
 */
const getVapidKey = asyncHandler(async (req, res, next) => {
  const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BMqwkM82TLGZAKMZwoabby-SY2JNRGIP6L_lZHYzEtdrCwvZ3YZY0uL1c4CD6udFi47VrZPJAkm6kLU8uShen2U';
  
  res.status(200).json({
    status: 'success',
    data: { publicKey: publicVapidKey }
  });
});

/**
 * @desc    Subscribe to push notifications
 * @route   POST /api/notifications/subscribe
 * @access  Private
 */
const subscribePush = asyncHandler(async (req, res, next) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ status: 'fail', message: 'اشتراك غير صالح!' });
  }

  // Check if already exists
  const existingSub = await PushSubscription.findOne({ endpoint: subscription.endpoint });
  
  if (!existingSub) {
    await PushSubscription.create({
      user: req.user._id,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    });
  } else if (existingSub.user.toString() !== req.user._id.toString()) {
    // If endpoint exists but for different user, update it
    existingSub.user = req.user._id;
    await existingSub.save();
  }

  res.status(201).json({
    status: 'success',
    message: 'تم الاشتراك بنجاح في الإشعارات!'
  });
});

module.exports = {
  getMyNotifications,
  markAsRead,
  getVapidKey,
  subscribePush
};
