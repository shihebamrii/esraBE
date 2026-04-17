/**
 * Checkout Controller / كونترولر الدفع
 * هنا نتعاملو مع الـ checkout وإنشاء الطلبات
 */

const { Order, Cart, Photo, Pack, Content, AuditLog, UserPack } = require('../models');
const { getPaymentProvider } = require('../services/paymentAdapter');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    Redeem a download using a purchased membership pack
 * @route   POST /api/checkout/redeem
 * @access  Private
 */
const redeemDownload = asyncHandler(async (req, res, next) => {
  const { itemId, itemType } = req.body; // itemType: 'photo' or 'content'

  if (!['photo', 'content'].includes(itemType)) {
    return next(new AppError('Invalid item type for redemption', 400));
  }

  // 1. Get the item
  let item;
  if (itemType === 'photo') {
    item = await Photo.findById(itemId);
  } else {
    item = await Content.findById(itemId);
  }

  if (!item) {
    return next(new AppError('Item not found', 404));
  }

  // 2. Determine module (Tounesna for photos, Impact for content/videos)
  const module = itemType === 'photo' ? 'tounesna' : 'impact';

  // 3. Find an active pack with remaining quota for this module
  const userPack = await UserPack.findOne({
    userId: req.user._id,
    module,
    isActive: true,
  });

  if (!userPack) {
    return next(new AppError(`No active ${module} membership pack found.`, 403));
  }

  // 4. Check quota based on item type
  let quotaField;
  if (itemType === 'photo') {
    quotaField = 'photosRemaining';
  } else {
    // For Content, it could be video, reel, or documentary
    if (item.type === 'reel') quotaField = 'reelsRemaining';
    else if (item.type === 'documentary') quotaField = 'documentariesRemaining';
    else quotaField = 'videosRemaining';
  }

  if (userPack.quotas[quotaField] <= 0) {
    return next(new AppError(`You have reached your limit of ${quotaField.replace('Remaining', '')} for this pack.`, 403));
  }

  // 5. Deduct from quota
  userPack.quotas[quotaField] -= 1;
  await userPack.save();

  // 6. Create a free order to grant download access
  const order = await Order.create({
    userId: req.user._id,
    items: [{
      type: itemType,
      itemId: item._id,
      price: 0,
      title: item.title,
    }],
    total: 0,
    currency: 'TND',
    paymentStatus: 'paid',
    paymentProvider: 'mock',
    paidAt: new Date(),
    notes: `Redeemed from ${module} pack`,
  });

  // Generate the download token
  const rawToken = order.createDownloadToken(itemType, item._id, 24);
  const rawTokens = {};
  rawTokens[`${itemType}_${item._id.toString()}`] = rawToken;
  order.metadata = { ...order.metadata, rawTokens };
  await order.save();

  await AuditLog.log({
    userId: req.user._id,
    action: 'PACK_REDEEM',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `${itemType}:${item._id}`,
    result: 'success',
  });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.status(200).json({
    status: 'success',
    message: 'Download redeemed successfully!',
    data: {
      orderId: order._id,
      downloadUrl: `${baseUrl}/api/orders/${order._id}/download/${rawToken}`,
    }
  });
});


/**
 * @desc    إنشاء طلب جديد
 * @route   POST /api/checkout
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res, next) => {
  const { billingInfo, notes } = req.body;

  // نجيبو السلة
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart || cart.items.length === 0) {
    return next(new AppError('السلة فارغة!', 400));
  }

  // نحدثو الأسعار قبل الدفع
  await cart.refreshPrices();

  // نحسبو المجموع
  const total = cart.total;

  if (total <= 0) {
    return next(new AppError('المجموع لازم يكون أكبر من صفر!', 400));
  }

  // ننشئو الطلب
  const order = await Order.create({
    userId: req.user._id,
    items: cart.items.map((item) => ({
      type: item.type,
      itemId: item.itemId,
      price: item.price,
      title: item.title,
      licenseType: item.licenseType || 'personal',
    })),
    total,
    currency: 'TND',
    paymentStatus: 'pending',
    billingInfo,
    notes,
  });

  // نجيبو مزود الدفع ونبدأو عملية الدفع
  const paymentProvider = getPaymentProvider();
  const paymentResult = await paymentProvider.createPayment({
    orderId: order._id.toString(),
    amount: total,
    currency: 'TND',
    customerEmail: billingInfo.email || req.user.email,
    customerName: billingInfo.name || req.user.name,
    description: `Order #${order._id}`,
  });

  // نحدثو الطلب بمعلومات الدفع
  order.paymentProvider = paymentProvider.name;
  order.metadata = {
    ...order.metadata,
    paymentSession: paymentResult.sessionId || paymentResult.paymentId,
  };
  await order.save();

  await AuditLog.log({
    userId: req.user._id,
    action: 'ORDER_CREATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Order:${order._id}`,
    result: 'success',
  });

  res.status(201).json({
    status: 'success',
    message: 'تم إنشاء الطلب! وجهك للدفع.',
    data: {
      order: {
        id: order._id,
        total: order.total,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
      },
      payment: {
        url: paymentResult.paymentUrl,
        sessionId: paymentResult.sessionId,
      },
    },
  });
});

/**
 * @desc    الحصول على طلب
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrder = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const order = await Order.findById(id);

  if (!order) {
    return next(new AppError('الطلب ما لقيناهش!', 404));
  }

  // نتأكدو الطلب للمستخدم الحالي (أو أدمن)
  if (
    order.userId.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return next(new AppError('ما عندكش صلاحية!', 403));
  }

  // نحضرو روابط التحميل لو الطلب مدفوع
  let downloadLinks = [];
  if (order.paymentStatus === 'paid') {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    downloadLinks = order.downloadTokens
      .map((t) => ({
        type: t.itemType,
        itemId: t.itemId,
        downloadUrl: `${baseUrl}/api/orders/${order._id}/download/${t.token}`,
      }));
  }

  res.status(200).json({
    status: 'success',
    data: {
      order: {
        id: order._id,
        items: order.items,
        total: order.total,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        downloadLinks,
      },
    },
  });
});

/**
 * @desc    قائمة طلبات المستخدم
 * @route   GET /api/orders
 * @access  Private
 */
const getMyOrders = asyncHandler(async (req, res, _next) => {
  const { page = 1, limit = 10, status } = req.query;

  const query = { userId: req.user._id };
  if (status) query.paymentStatus = status;

  const total = await Order.countDocuments(query);

  const orders = await Order.find(query)
    .select('items total currency paymentStatus createdAt paidAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { orders },
  });
});

/**
 * @desc    تحميل ملف مشتري
 * @route   GET /api/orders/:orderId/download/:token
 * @access  Private
 */
const downloadPurchasedItem = asyncHandler(async (req, res, next) => {
  const { orderId, token } = req.params;

  const order = await Order.findById(orderId);

  if (!order) {
    return next(new AppError('الطلب ما لقيناهش!', 404));
  }

  // ملاحظة: التوكن سري ويعتبر إثبات كافي لملكية الطلب
  // حذفنا التحقق من req.user._id لأن متصفح التحميل العادي (a tag) ما يبعثش Authorization header

  // نتأكدو الطلب مدفوع
  if (order.paymentStatus !== 'paid') {
    return next(new AppError('الطلب مش مدفوع!', 403));
  }

  // نتأكدو من التوكن
  const tokenDoc = order.verifyDownloadToken(token);

  if (!tokenDoc) {
    return next(new AppError('رابط التحميل منتهي أو غالط!', 403));
  }

  // نجيبو الملف
  let fileId;
  let filename;
  let externalUrl;

  if (tokenDoc.itemType === 'photo') {
    const photo = await Photo.findById(tokenDoc.itemId);
    if (!photo) return next(new AppError('الصورة ما لقيناهاش!', 404));
    
    if (photo.highResFileId) {
      fileId = photo.highResFileId;
      filename = photo.fileInfo?.highRes?.filename || `photo_${photo._id}.jpg`;
    } else if (photo.imageUrl) {
      externalUrl = photo.imageUrl;
    } else {
      return next(new AppError('ملف الصورة الأصلي غير موجود!', 404));
    }
  } else if (tokenDoc.itemType === 'pack') {
    const pack = await Pack.findById(tokenDoc.itemId).populate('photoIds');
    if (!pack) return next(new AppError('الباك ما لقيناهش!', 404));

    if (pack.type !== 'collection') {
      return next(new AppError('هذا الباك لا يدعم التحميل المباشر!', 400));
    }

    // نبعثو ZIP مباشرة
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(pack.title)}.zip"`,
    });

    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(res);

    const { getDownloadStream } = require('../services/storageService');

    for (const photo of pack.photoIds) {
      const fileId = photo.highResFileId;
      if (fileId) {
        const stream = getDownloadStream(fileId);
        const filename = photo.fileInfo?.highRes?.filename || `photo_${photo._id}.jpg`;
        archive.append(stream, { name: filename });
      }
    }

    await archive.finalize();
    
    // تسجيل التحميل (لا حاجة لـ redirect)
    await AuditLog.log({
      userId: order.userId,
      action: 'PACK_DOWNLOAD',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: `Pack:${pack._id}`,
      result: 'success',
    });
    
    // نستهلكو التوكن ونخرجوا
    await order.useDownloadToken(token);
    return;
  } else if (tokenDoc.itemType === 'content') {
    const content = await Content.findById(tokenDoc.itemId);
    if (!content) return next(new AppError('المحتوى ما لقيناهش!', 404));
    fileId = content.fileFileId;
    filename = content.fileInfo?.filename || `content_${content._id}`;
  }

  // نستهلكو استخدام من التوكن
  await order.useDownloadToken(token);

  // نسجلو التحميل
  await AuditLog.log({
    userId: order.userId,
    action: 'PHOTO_DOWNLOAD',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `${tokenDoc.itemType}:${tokenDoc.itemId}`,
    result: 'success',
  });

  // نعملو redirect للـ media stream أو الرابط الخارجي
  if (externalUrl) {
    res.redirect(externalUrl);
  } else {
    res.redirect(`/api/media/${fileId}/download`);
  }
});

/**
 * @desc    قائمة كل الطلبات (أدمن)
 * @route   GET /api/checkout/admin/orders
 * @access  Admin
 */
const getAllOrders = asyncHandler(async (req, res, _next) => {
  const { page = 1, limit = 20, status } = req.query;

  const query = {};
  if (status) query.paymentStatus = status;

  const total = await Order.countDocuments(query);

  const orders = await Order.find(query)
    .populate('userId', 'name email')
    .select('items total currency paymentStatus createdAt paidAt userId')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { orders },
  });
});

module.exports = {
  createOrder,
  getOrder,
  getMyOrders,
  getAllOrders,
  downloadPurchasedItem,
  redeemDownload,
};
