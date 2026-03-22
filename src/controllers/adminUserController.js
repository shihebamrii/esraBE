/**
 * Admin User Controller / كونترولر إدارة المستخدمين
 */

const { User, UserPack, Order, AuditLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    Get all users with their packs and quotas
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */
const getAllUsers = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, role, search } = req.query;

  const query = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select('-refreshTokens -passwordHash')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // For each user, get their active packs
  const usersWithPacks = await Promise.all(users.map(async (user) => {
    const packs = await UserPack.find({ userId: user._id, isActive: true })
      .populate('packId', 'title membershipFeatures');
    
    return {
      ...user.toObject(),
      packs
    };
  }));

  res.status(200).json({
    status: 'success',
    results: users.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { users: usersWithPacks },
  });
});

/**
 * @desc    Update user pack quotas
 * @route   PUT /api/admin/users/:userId/packs/:userPackId
 * @access  Private (Admin)
 */
const updateUserPackQuota = asyncHandler(async (req, res, next) => {
  const { userId, userPackId } = req.params;
  const { quotas } = req.body;

  const userPack = await UserPack.findOne({ _id: userPackId, userId });

  if (!userPack) {
    return next(new AppError('User pack not found', 404));
  }

  if (quotas) {
    userPack.quotas = {
      ...userPack.quotas,
      ...quotas
    };
  }

  await userPack.save();

  await AuditLog.log({
    userId: req.user._id,
    action: 'USER_PACK_QUOTA_UPDATE',
    resource: `UserPack:${userPackId}`,
    details: { targetUserId: userId, quotas },
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'Quotas updated successfully',
    data: { userPack },
  });
});

/**
 * @desc    Update user status (activate/deactivate)
 * @route   PUT /api/admin/users/:id/status
 * @access  Private (Admin)
 */
const updateUserStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await User.findByIdAndUpdate(id, { isActive }, { new: true });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: { user },
  });
});

module.exports = {
  getAllUsers,
  updateUserPackQuota,
  updateUserStatus,
};
