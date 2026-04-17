/**
 * Payment Controller / كونترولر الدفع
 * هنا نتعاملو مع webhooks وتأكيد الدفع
 */

const { Order, Cart, Photo, Pack, Content, AuditLog, UserPack } = require('../models');
const { getPaymentProvider } = require('../services/paymentAdapter');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    استقبال webhook من مزود الدفع
 * @route   POST /api/payment/webhook
 * @access  Public (لكن نتحققو من التوقيع)
 */
const handleWebhook = asyncHandler(async (req, res, next) => {
  const signature = req.headers['stripe-signature'] || req.headers['x-paytech-signature'] || '';
  const rawBody = req.body;
  let payload = req.body;

  // نحولو البودي لـ JSON للتعامل معاه، ونخليو الـ rawBody للتحقق من التوقيع
  if (Buffer.isBuffer(payload)) {
    try {
      payload = JSON.parse(payload.toString());
    } catch (e) {
      // لو مش JSON، نخليوه كما هو (ممكن يكون Stripe payload)
    }
  }

  const paymentProvider = getPaymentProvider();

  // نتحققو من التوقيع (نبعثو الـ rawBody لـ Stripe)
  const webhookPayload = paymentProvider.name === 'stripe' ? rawBody : payload;
  if (paymentProvider.name !== 'mock' && !paymentProvider.verifyWebhook(webhookPayload, signature)) {
    await AuditLog.log({
      action: 'SUSPICIOUS_ACTIVITY',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: { reason: 'Invalid payment webhook signature' },
      result: 'failure',
    });
    return next(new AppError('Webhook signature verification failed', 400));
  }

  // نحددو الـ orderId من الـ payload
  // هذا يختلف حسب المزود
  let orderId;
  let paymentStatus;

  if (paymentProvider.name === 'stripe') {
    // Stripe event structure
    const event = payload;
    if (event.type === 'checkout.session.completed') {
      orderId = event.data.object.metadata.orderId;
      paymentStatus = 'paid';
    }
  } else if (paymentProvider.name === 'paytech') {
    // TODO: PayTech event structure
    orderId = payload.order_id;
    paymentStatus = payload.status === 'success' ? 'paid' : 'failed';
  } else {
    // Mock - نقبلو أي payload
    orderId = payload.orderId || payload.order_id || payload.payment_id || payload.id || req.query.orderId;
    paymentStatus = 'paid';
  }

  if (!orderId) {
    return res.status(200).json({ received: true, message: 'No order to process' });
  }

  // نجيبو الطلب
  const order = await Order.findById(orderId);

  if (!order) {
    console.error(`Order not found: ${orderId}`);
    return res.status(200).json({ received: true, error: 'Order not found' });
  }

  // لو الطلب مدفوع مسبقا، ما نعملوش شي
  if (order.paymentStatus === 'paid') {
    return res.status(200).json({ received: true, message: 'Already processed' });
  }

  if (paymentStatus === 'paid') {
    // نحدثو الطلب
    order.paymentStatus = 'paid';
    order.paidAt = new Date();
    order.paymentId = payload.id || payload.payment_id;

    // ننشئو توكنز التحميل لكل عنصر ونحطو الخام في الميتاداتا
    const rawTokens = {};
    for (const item of order.items) {
      // نزيدو التوكن للعنصر الأصلي (سواء كان صورة أو باك أو محتوى)
      const rawToken = order.createDownloadToken(item.type, item.itemId, 24);
      rawTokens[`${item.type}_${item.itemId.toString()}`] = rawToken;

      // لو العنصر باك من نوع collection، نزيدو توكنز لكل الصور الي فيه
      if (item.type === 'pack') {
        const pack = await Pack.findById(item.itemId);
        if (pack && pack.type === 'collection' && pack.photoIds?.length > 0) {
          for (const photoId of pack.photoIds) {
            const photoToken = order.createDownloadToken('photo', photoId, 24);
            rawTokens[`photo_${photoId.toString()}`] = photoToken;
          }
        }
      }
    }
    
    order.metadata = { ...order.metadata, rawTokens };

    await order.save();

    // نفرغو سلة المستخدم
    await Cart.findOneAndUpdate(
      { userId: order.userId },
      { items: [], lastPriceUpdate: null }
    );

    // نحدثو عدد المبيعات للصور/الباكات
    for (const item of order.items) {
      if (item.type === 'photo') {
        await Photo.findByIdAndUpdate(item.itemId, { $inc: { purchases: 1 } });
      } else if (item.type === 'pack') {
        const pack = await Pack.findById(item.itemId);
        if (pack) {
          pack.purchases += 1;
          await pack.save();

          // لو الباك من نوع membership، نفعلوه للمستخدم
          if (pack.type === 'membership' && pack.membershipFeatures) {
            await UserPack.create({
              userId: order.userId,
              packId: pack._id,
              orderId: order._id,
              module: pack.membershipFeatures.module,
              quotas: {
                photosRemaining: pack.membershipFeatures.photosLimit || 0,
                reelsRemaining: pack.membershipFeatures.reelsLimit || 0,
                videosRemaining: pack.membershipFeatures.videosLimit || 0,
                documentariesRemaining: pack.membershipFeatures.documentariesLimit || 0,
                podcastsRemaining: pack.membershipFeatures.podcastsLimit || 0,
                successStoryRemaining: pack.membershipFeatures.successStoryLimit || 0,
              },
              quality: pack.membershipFeatures.quality,
              isActive: true,
            });
          }
        }
      } else if (item.type === 'content') {
        await Content.findByIdAndUpdate(item.itemId, { $inc: { downloads: 1 } });
      }
    }

    await AuditLog.log({
      userId: order.userId,
      action: 'ORDER_PAID',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: `Order:${orderId}`,
      result: 'success',
    });
  } else if (paymentStatus === 'failed') {
    order.paymentStatus = 'failed';
    await order.save();
  }

  res.status(200).json({ received: true });
});

/**
 * @desc    Mock payment completion (للتطوير فقط)
 * @route   GET /api/payment/mock-complete
 * @access  Public (dev only)
 */
const mockComplete = asyncHandler(async (req, res, next) => {
  const { sessionId, orderId } = req.query;

  // نتأكدو احنا في التطوير
  if (process.env.NODE_ENV === 'production') {
    return next(new AppError('Not available in production', 403));
  }

  // نعملو نفس الخطوات كالـ webhook
  const fakePayload = {
    orderId,
    sessionId,
    id: sessionId,
    status: 'success',
  };

  // نعيطو لـ handleWebhook
  const fakeRes = {
    status: function(code) { 
      this.statusCode = code; 
      return this; 
    },
    json: function(data) { 
      this.data = data; 
      return this; 
    }
  };

  req.body = fakePayload;
  await handleWebhook(req, fakeRes, next);

  // نوجهو المستخدم لصفحة الطلبات في الفرونت
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  // Use 303 See Other to ensure it's a GET request
  res.redirect(303, `${frontendUrl}/orders?session_id=${sessionId}&success=true`);
});

/**
 * @desc    التحقق من حالة الدفع
 * @route   GET /api/payment/status/:orderId
 * @access  Private
 */
const getPaymentStatus = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);

  if (!order) {
    return next(new AppError('الطلب ما لقيناهش!', 404));
  }

  // نتأكدو الطلب للمستخدم
  if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('ما عندكش صلاحية!', 403));
  }

  // لو الطلب pending، نتحققو من المزود
  if (order.paymentStatus === 'pending' && order.metadata?.paymentSession) {
    try {
      const paymentProvider = getPaymentProvider();
      const status = await paymentProvider.getPaymentStatus(order.metadata.paymentSession);
      
      if (status.status === 'paid') {
        // نحدثو مثل الـ webhook - نعيطو لنفس اللوجيك
        const fakeReq = {
          body: { orderId: order._id, id: order.metadata.paymentSession },
          ip: req.ip,
          get: (header) => req.get(header),
        };
        
        // نحضرو ريسبونس وهمية باش ما يبعثش داتا مرتين
        const fakeRes = {
          status: () => ({ json: () => {} }),
        };
        
        await handleWebhook(fakeReq, fakeRes, next);
        
        // نعاودو نجيبو الأوردر باش نبعثو الداتا الجديدة
        const updatedOrder = await Order.findById(orderId);
        return res.status(200).json({
          status: 'success',
          data: {
            orderId: updatedOrder._id,
            paymentStatus: updatedOrder.paymentStatus,
            paidAt: updatedOrder.paidAt,
          },
        });
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      paidAt: order.paidAt,
    },
  });
});

module.exports = {
  handleWebhook,
  mockComplete,
  getPaymentStatus,
};
