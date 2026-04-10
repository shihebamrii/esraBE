/**
 * Dashboard Controller / كونترولر لوحة التحكم
 * هنا نجمعو الإحصائيات والبيانات الخاصة بالمستخدم
 */

const { Content, Photo, User, Order, Pack, UserPack } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    Get User Purchased Packs & Quotas
 * @route   GET /api/dashboard/packs
 * @access  Private (User)
 */
const getUserPacks = asyncHandler(async (req, res, next) => {
  const packs = await UserPack.find({ userId: req.user._id, isActive: true })
    .populate('packId', 'title description membershipFeatures')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: packs.length,
    data: { packs },
  });
});


/**
 * @desc    Get User Upload Stats
 * @route   GET /api/dashboard/stats
 * @access  Private (User)
 */
const getUserUploadStats = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // 1. Total Content (Videos, Audio, etc.)
  const contentStats = await Content.aggregate([
    { $match: { createdBy: userId } },
    { 
      $group: { 
        _id: null, 
        total: { $sum: 1 },
        totalViews: { $sum: "$views" },
        totalDownloads: { $sum: "$downloads" },
        published: { 
          $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } // Assuming there's a status field or relying on visibility/approved
        },
        videos: { 
            $sum: { $cond: [{ $eq: ["$type", "video"] }, 1, 0] }
        },
        audio: { 
            $sum: { $cond: [{ $eq: ["$type", "audio"] }, 1, 0] }
        }
      } 
    }
  ]);

  // 2. Photos Stats
  const photoStats = await Photo.aggregate([
    { $match: { createdBy: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalDownloads: { $sum: "$previewDownloads" }, // Assuming preview downloads is the main metric for free photos
        totalSales: { $sum: "$purchases" },
        totalSalesAmount: { $sum: { $multiply: ["$purchases", "$priceTND"] } }
      }
    }
  ]);

  const stats = {
    content: {
      total: contentStats[0]?.total || 0,
      views: contentStats[0]?.totalViews || 0,
      downloads: contentStats[0]?.totalDownloads || 0,
      videoCount: contentStats[0]?.videos || 0,
      audioCount: contentStats[0]?.audio || 0
    },
    photos: {
      total: photoStats[0]?.total || 0,
      downloads: photoStats[0]?.totalDownloads || 0,
      sales: photoStats[0]?.totalSales || 0,
      earnings: photoStats[0]?.totalSalesAmount || 0
    },
    totalUploads: (contentStats[0]?.total || 0) + (photoStats[0]?.total || 0),
    totalViews: (contentStats[0]?.totalViews || 0) // Photos typically don't track views in this schema, mainly downloads/sales? If they do, add here.
  };

  res.status(200).json({
    status: 'success',
    data: stats
  });
});

/**
 * @desc    Get Recent Activity
 * @route   GET /api/dashboard/recent
 * @access  Private (User)
 */
const getRecentActivity = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const limit = 5;

  // Fetch recent contents
  const recentContent = await Content.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title type createdAt views status'); // Adjust fields as needed

  // Fetch recent photos
  const recentPhotos = await Photo.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title type createdAt previewDownloads status'); // Photos don't have 'type' field per se, add it manually

  // Combine and sort
  let combined = [
    ...recentContent.map(c => ({
      _id: c._id,
      title: c.title,
      type: c.type, // video, audio, etc.
      category: 'content',
      createdAt: c.createdAt,
      metric: c.views, // Views for content
      metricLabel: 'Views',
      status: 'published' // Defaulting to published as schema doesn't seem to have status explicitly, only visibility
    })),
    ...recentPhotos.map(p => ({
      _id: p._id,
      title: p.title,
      type: 'photo',
      category: 'photo',
      createdAt: p.createdAt,
      metric: p.previewDownloads, // Downloads for photos
      metricLabel: 'Downloads',
      status: 'published'
    }))
  ];

  // Sort combined array by date desc and take top 5
  combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const recentActivity = combined.slice(0, limit);

  res.status(200).json({
    status: 'success',
    data: recentActivity
  });
});

/**
 * @desc    Get User Stats
 * @route   GET /api/dashboard/user-stats
 * @access  Private (User)
 */
const getUserStats = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // 1. Get User Orders
  const orders = await Order.find({ userId: userId }).sort({ createdAt: -1 });
  
  // 2. Calculate Total Spent
  const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);

  // 3. Count Downloads (Purchased Items)
  // Assuming each order has items, we count unique contentIds or similar
  let downloadCount = 0;
  orders.forEach(order => {
    if (order.status === 'completed' || order.paymentStatus === 'paid') {
      downloadCount += order.items?.length || 0;
    }
  });

  // 4. Recent Orders (limit to 3 for the dashboard)
  const recentOrders = orders.slice(0, 3).map(order => ({
    id: order._id,
    orderNumber: order._id.toString().substring(0, 8).toUpperCase(), // Fallback if no orderNumber
    items: order.items?.length || 0,
    total: `${(order.total || 0).toFixed(2)} ${order.currency || 'TND'}`,
    status: order.paymentStatus || 'pending',
    date: order.createdAt
  }));

  res.status(200).json({
    status: 'success',
    data: {
      totalOrders: orders.length,
      totalSpent: `${totalSpent.toFixed(2)} TND`,
      downloadCount,
      recentOrders
    }
  });
});

/**
 * @desc    Get Admin Stats
 * @route   GET /api/dashboard/admin-stats
 * @access  Private (Admin)
 */
const getAdminStats = asyncHandler(async (req, res, next) => {
  // 1. Total Revenue
  const orders = await Order.find({ paymentStatus: 'paid' });
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);

  // 2. Active Users
  const totalUsers = await User.countDocuments();
  
  // 3. Content counts
  const videoCount = await Content.countDocuments({ type: 'video' });
  const photoCount = await Photo.countDocuments();

  res.status(200).json({
    status: 'success',
    data: {
      totalRevenue: `${totalRevenue.toLocaleString()} TND`,
      activeUsers: totalUsers,
      videoCount,
      photoCount
    }
  });
});

/**
 * @desc    Get User Downloads (Purchased items)
 * @route   GET /api/dashboard/downloads
 * @access  Private (User)
 */
const getMyDownloads = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const orders = await Order.find({ userId, paymentStatus: 'paid' });

  let itemsMap = new Map();

  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.type}_${item.itemId.toString()}`;
      if (!itemsMap.has(key)) {
        itemsMap.set(key, { ...item.toObject(), orderId: order._id, purchaseDate: order.paidAt || order.createdAt });
      }
    }
  }

  const downloads = Array.from(itemsMap.values());

  const photoIds = downloads.filter(d => d.type === 'photo').map(d => d.itemId);
  const packIds = downloads.filter(d => d.type === 'pack').map(d => d.itemId);
  const contentIds = downloads.filter(d => d.type === 'content').map(d => d.itemId);

  const photos = await Photo.find({ _id: { $in: photoIds } }).lean();
  const packs = await Pack.find({ _id: { $in: packIds } }).lean();
  const contents = await Content.find({ _id: { $in: contentIds } }).lean();

  const photoMap = new Map(photos.map(p => [p._id.toString(), p]));
  const packMap = new Map(packs.map(p => [p._id.toString(), p]));
  const contentMap = new Map(contents.map(p => [p._id.toString(), p]));

  const enrichedDownloads = downloads.map(d => {
    let itemData = null;
    let format = '';
    let size = '';

    if (d.type === 'photo') {
      itemData = photoMap.get(d.itemId.toString());
      format = 'JPEG';
      size = 'High Res';
    } else if (d.type === 'pack') {
      itemData = packMap.get(d.itemId.toString());
      format = 'ZIP';
      size = 'Pack';
    } else if (d.type === 'content') {
      itemData = contentMap.get(d.itemId.toString());
      format = itemData?.type === 'video' ? 'MP4' : 'File';
      size = 'Original';
    }

    // Active tokens for this item from this order
    const order = orders.find(o => o._id.toString() === d.orderId.toString());
    let tokenStr = null;
    if (order) {
       const tokenDoc = order.downloadTokens.find(t => t.itemId.toString() === d.itemId.toString());
       if (tokenDoc && order.metadata?.rawTokens) {
         tokenStr = order.metadata.rawTokens[`${d.type}_${d.itemId.toString()}`];
       }
       
       // Fallback for legacy orders/redeems that didn't save the raw token
       if (!tokenStr && order.paymentStatus === 'paid') {
         tokenStr = order.createDownloadToken(d.type, d.itemId, 24);
         const rawTokens = order.metadata?.rawTokens || {};
         rawTokens[`${d.type}_${d.itemId.toString()}`] = tokenStr;
         order.metadata = { ...order.metadata, rawTokens };
         order.save().catch(err => console.error('Failed to save legacy token:', err));
       }
    }

    return {
      id: d.itemId.toString() + '_' + d.orderId.toString(),
      itemId: d.itemId,
      title: itemData?.title || d.title || 'Unknown Item',
      type: d.type === 'photo' ? 'Photo' : d.type === 'pack' ? 'Pack' : 'Video',
      purchaseDate: d.purchaseDate,
      size,
      format,
      orderId: d.orderId,
      downloadToken: tokenStr,
      thumbnail: itemData?.thumbnailFileId ? `${baseUrl}/api/media/${itemData.thumbnailFileId}` : (itemData?.lowResFileId ? `${baseUrl}/api/photos/${itemData._id}/preview` : (itemData?.imageUrl || null))
    };
  });

  const validDownloads = enrichedDownloads.filter(d => d.title !== 'Unknown Item');

  res.status(200).json({
    status: 'success',
    data: validDownloads
  });
});

/**
 * @desc    Get My Photos (filtered by logged-in user)
 * @route   GET /api/dashboard/my-photos
 * @access  Private (User)
 */
const getMyPhotos = asyncHandler(async (req, res, _next) => {
  const userId = req.user._id;
  const {
    page = 1,
    limit = 20,
    sort = '-createdAt',
  } = req.query;

  const query = { createdBy: userId };
  const total = await Photo.countDocuments(query);

  const photos = await Photo.find(query)
    .select('title description governorate landscapeType priceTND lowResFileId imageUrl tags createdAt previewDownloads')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Build an absolute base URL so the frontend (port 3000) can reach the backend (port 5000)
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  // Add preview URLs
  const photosWithUrls = photos.map(photo => {
    const obj = photo.toObject();
    // If the photo has an external imageUrl, use that; otherwise build a full backend URL
    if (photo.imageUrl) {
      obj.previewUrl = photo.imageUrl;
    } else {
      obj.previewUrl = `${baseUrl}/api/photos/${photo._id}/preview`;
    }
    return obj;
  });

  res.status(200).json({
    status: 'success',
    results: photos.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { photos: photosWithUrls },
  });
});

/**
 * @desc    Get My Content (filtered by logged-in user)
 * @route   GET /api/dashboard/my-content
 * @access  Private (User)
 */
const getMyContent = asyncHandler(async (req, res, _next) => {
  const userId = req.user._id;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const {
    page = 1,
    limit = 20,
    type,
    sort = '-createdAt',
  } = req.query;

  const query = { createdBy: userId };
  if (type) query.type = type;

  const total = await Content.countDocuments(query);

  const contents = await Content.find(query)
    .select('-__v')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  const contentsWithUrls = contents.map(content => {
    const obj = content.toObject();
    obj.thumbnailUrl = content.thumbnailFileId ? `${baseUrl}/api/media/${content.thumbnailFileId}` : null;
    obj.contentUrl = `${baseUrl}/api/media/${content.fileFileId}`;
    return obj;
  });

  res.status(200).json({
    status: 'success',
    results: contents.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { contents: contentsWithUrls },
  });
});

module.exports = {
  getUserUploadStats,
  getRecentActivity,
  getUserPacks,
  getUserStats,
  getAdminStats,
  getMyDownloads,
  getMyPhotos,
  getMyContent
};
