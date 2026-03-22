const webpush = require('web-push');
const { Notification, PushSubscription, User } = require('../models');

// Configure VAPID keys
// Fallbacks for demo purposes
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BMqwkM82TLGZAKMZwoabby-SY2JNRGIP6L_lZHYzEtdrCwvZ3YZY0uL1c4CD6udFi47VrZPJAkm6kLU8uShen2U';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'priZ2FOGIJQ6Qkejvnr8DQS5qXUc8i2K7n0O-lnkuk4';
const email = process.env.VAPID_EMAIL || 'mailto:admin@mediatheque.tn';

webpush.setVapidDetails(email, publicVapidKey, privateVapidKey);

/**
 * Send a push notification to a specific user
 */
const sendPushToUser = async (userId, payload) => {
  try {
    const subscriptions = await PushSubscription.find({ user: userId });
    
    if (!subscriptions || subscriptions.length === 0) return;

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or is invalid, remove it
          await PushSubscription.findByIdAndDelete(sub._id);
        } else {
          console.error('Error sending push:', err);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendPushToUser:', error);
  }
};

/**
 * Notify a specific user and save to DB
 */
const notifyUser = async (userId, { title, message, type = 'system', link = '/' }) => {
  try {
    // Save to DB
    const notification = await Notification.create({
      recipient: userId,
      title,
      message,
      type,
      link
    });

    // Send Web Push
    await sendPushToUser(userId, {
      title,
      body: message,
      url: link,
      icon: '/icon-192x192.png' // Make sure you have this icon in frontend public folder later
    });

    return notification;
  } catch (error) {
    console.error('Failed to notify user:', error);
  }
};

/**
 * Notify all users (Clients) and save to DB
 */
const notifyAllUsers = async ({ title, message, type = 'new_content', link = '/' }) => {
  try {
    // Get all non-admin users
    const users = await User.find({ role: { $ne: 'admin' } }).select('_id');
    
    if (users.length === 0) return;

    // Save notifications in bulk
    const notificationsToInsert = users.map(u => ({
      recipient: u._id,
      title,
      message,
      type,
      link
    }));

    await Notification.insertMany(notificationsToInsert);

    // Send push to everyone async
    const payload = {
      title,
      body: message,
      url: link,
      icon: '/icon-192x192.png'
    };

    // We fetch all subscriptions
    const allSubs = await PushSubscription.find({});
    for (const sub of allSubs) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      } catch (err) {
         if (err.statusCode === 410 || err.statusCode === 404) {
           await PushSubscription.findByIdAndDelete(sub._id);
         }
      }
    }

  } catch (error) {
    console.error('Failed to notify all users:', error);
  }
};

module.exports = {
  notifyUser,
  notifyAllUsers
};
