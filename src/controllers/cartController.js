/**
 * Cart Controller / كونترولر السلة
 * هنا نتعاملو مع سلة المشتريات
 */

const { Cart, Photo, Pack, Content } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    الحصول على السلة
 * @route   GET /api/cart
 * @access  Private
 */
const getCart = asyncHandler(async (req, res, _next) => {
  const cart = await Cart.getOrCreate(req.user._id);

  res.status(200).json({
    status: 'success',
    data: {
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    },
  });
});

/**
 * @desc    إضافة عنصر للسلة
 * @route   POST /api/cart
 * @access  Private
 */
const addToCart = asyncHandler(async (req, res, next) => {
  const { type, itemId, licenseType = 'personal' } = req.body;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // نتأكدو نوع الترخيص صحيح
  if (!['personal', 'commercial'].includes(licenseType)) {
    return next(new AppError('نوع الترخيص مش صحيح!', 400));
  }

  // نجيبو العنصر باش ناخذو السعر والعنوان
  let item;
  let price;
  let title;
  let thumbnail;

  switch (type) {
    case 'photo':
      item = await Photo.findById(itemId);
      if (!item) return next(new AppError('الصورة ما لقيناهاش!', 404));
      if (licenseType === 'commercial') {
        price = item.priceCommercialTND || item.priceTND;
      } else {
        price = item.pricePersonalTND || item.priceTND;
      }
      title = item.title;
      thumbnail = `${baseUrl}/api/photos/${itemId}/preview`;
      break;

    case 'pack':
      item = await Pack.findById(itemId);
      if (!item || !item.isActive) return next(new AppError('الباك ما لقيناهش!', 404));
      price = item.priceTND;
      title = item.title;
      break;

    case 'content':
      item = await Content.findById(itemId);
      if (!item) return next(new AppError('المحتوى ما لقيناهش!', 404));
      if (item.rights === 'free') return next(new AppError('المحتوى مجاني!', 400));
      if (licenseType === 'commercial') {
        price = item.priceCommercial || item.price;
      } else {
        price = item.pricePersonal || item.price;
      }
      title = item.title;
      thumbnail = item.thumbnailFileId ? `${baseUrl}/api/media/${item.thumbnailFileId}` : null;
      break;

    default:
      return next(new AppError('نوع العنصر مش صحيح!', 400));
  }

  // لو السعر 0، ما نضيفوهش للسلة
  if (price === 0) {
    return next(new AppError('العنصر مجاني ما تحتاجش تشريه!', 400));
  }

  // نجيبو السلة ونضيفو العنصر
  const cart = await Cart.getOrCreate(req.user._id);

  await cart.addItem({
    type,
    itemId,
    price,
    title,
    thumbnail,
    licenseType,
  });

  res.status(200).json({
    status: 'success',
    message: 'تمت الإضافة للسلة!',
    data: {
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    },
  });
});

/**
 * @desc    حذف عنصر من السلة
 * @route   DELETE /api/cart/:itemId
 * @access  Private
 */
const removeFromCart = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;

  const cart = await Cart.getOrCreate(req.user._id);

  // نتأكدو العنصر موجود
  const itemExists = cart.items.some((item) => item._id.toString() === itemId);
  if (!itemExists) {
    return next(new AppError('العنصر مش في السلة!', 404));
  }

  await cart.removeItem(itemId);

  res.status(200).json({
    status: 'success',
    message: 'تم الحذف من السلة!',
    data: {
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    },
  });
});

/**
 * @desc    تفريغ السلة
 * @route   DELETE /api/cart
 * @access  Private
 */
const clearCart = asyncHandler(async (req, res, _next) => {
  const cart = await Cart.getOrCreate(req.user._id);
  await cart.clear();

  res.status(200).json({
    status: 'success',
    message: 'تم تفريغ السلة!',
    data: {
      cart: {
        items: [],
        total: 0,
        itemCount: 0,
      },
    },
  });
});

/**
 * @desc    تحديث أسعار السلة
 * @route   POST /api/cart/refresh
 * @access  Private
 */
const refreshCart = asyncHandler(async (req, res, _next) => {
  const cart = await Cart.getOrCreate(req.user._id);
  await cart.refreshPrices();

  res.status(200).json({
    status: 'success',
    message: 'تم تحديث الأسعار!',
    data: {
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    },
  });
});

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  refreshCart,
};
