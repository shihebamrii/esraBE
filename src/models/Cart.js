/**
 * Cart Model / موديل السلة
 * هنا نخزنو سلة المشتريات للمستخدم
 */

const mongoose = require('mongoose');

// سكيما لعنصر في السلة
const cartItemSchema = new mongoose.Schema(
  {
    // نوع العنصر
    type: {
      type: String,
      enum: ['photo', 'pack', 'content'],
      required: true,
    },
    
    // مرجع العنصر
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    
    // السعر وقت الإضافة
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // العنوان (نسخة)
    title: String,

    // صورة مصغرة (URL)
    thumbnail: String,

    // تاريخ الإضافة
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    // المستخدم - كل واحد عندو سلة وحدة
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // العناصر في السلة
    items: [cartItemSchema],

    // آخر تحديث للأسعار
    lastPriceUpdate: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// Indexes / الفهارس
// ============================================

// cartSchema.index({ userId: 1 }); // Redundant since userId has unique: true

// ============================================
// Virtuals / الخصائص الافتراضية
// ============================================

/**
 * المجموع
 */
cartSchema.virtual('total').get(function () {
  if (!this.items || this.items.length === 0) return 0;
  return this.items.reduce((sum, item) => sum + (item.price || 0), 0);
});

/**
 * عدد العناصر
 */
cartSchema.virtual('itemCount').get(function () {
  return this.items ? this.items.length : 0;
});

// ============================================
// Instance Methods / ميثودز الانستانس
// ============================================

/**
 * نضيفو عنصر للسلة
 * @param {Object} itemData - بيانات العنصر
 */
cartSchema.methods.addItem = async function (itemData) {
  // نتأكدو العنصر موش موجود مسبقا
  const exists = this.items.some(
    (item) => item.type === itemData.type && item.itemId.toString() === itemData.itemId.toString()
  );
  
  if (exists) {
    const AppError = require('../utils/AppError');
    throw new AppError('العنصر موجود مسبقا في السلة!', 400);
  }
  
  this.items.push(itemData);
  await this.save();
};

/**
 * نمسحو عنصر من السلة
 * @param {string} itemId - معرف العنصر في السلة
 */
cartSchema.methods.removeItem = async function (itemId) {
  this.items = this.items.filter((item) => item._id.toString() !== itemId);
  await this.save();
};

/**
 * نفرغو السلة
 */
cartSchema.methods.clear = async function () {
  this.items = [];
  await this.save();
};

/**
 * نحدثو الأسعار من قاعدة البيانات
 */
cartSchema.methods.refreshPrices = async function () {
  const Photo = require('./Photo');
  const Pack = require('./Pack');
  const Content = require('./Content');
  
  for (const item of this.items) {
    let Model;
    switch (item.type) {
      case 'photo':
        Model = Photo;
        break;
      case 'pack':
        Model = Pack;
        break;
      case 'content':
        Model = Content;
        break;
    }
    
    if (Model) {
      const doc = await Model.findById(item.itemId);
      if (doc) {
        item.price = doc.priceTND || doc.price || 0;
        item.title = doc.title;
      }
    }
  }
  
  this.lastPriceUpdate = new Date();
  await this.save();
};

// ============================================
// Static Methods / ميثودز السكاتيك
// ============================================

/**
 * نجيبو ولا ننشئو سلة للمستخدم
 * @param {ObjectId} userId
 */
cartSchema.statics.getOrCreate = async function (userId) {
  let cart = await this.findOne({ userId });
  
  if (!cart) {
    cart = await this.create({ userId, items: [] });
  }
  
  return cart;
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
