// Import the mongoose library to interact with MongoDB database
const mongoose = require('mongoose');

// Define the schema/structure for a single item inside the shopping cart
const cartItemSchema = new mongoose.Schema(
  {
    // The type of item added to the cart: must be either 'photo', 'pack', or 'content'
    type: {
      type: String,
      enum: ['photo', 'pack', 'content'],
      required: true,
    },

    // The unique database identifier of the item in its respective database collection
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // The price of the item at the exact moment it was added to the cart (cannot be negative)
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // The title or name of the item
    title: String,

    // The URL path to the thumbnail image of the item
    thumbnail: String,

    // The type of license chosen for this item (personal use or commercial use)
    licenseType: {
      type: String,
      enum: ['personal', 'commercial'],
      default: 'personal',
    },

    // The date and time when this specific item was added to the cart (defaults to current time)
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  // Automatically generate a unique _id for each individual item inside the cart list
  { _id: true }
);

// Define the main cart schema for each user, containing the list of items
const cartSchema = new mongoose.Schema(
  {
    // The identifier of the user who owns this cart, linking directly to the User model
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // An array holding the list of items currently inside the shopping cart
    items: [cartItemSchema],

    // The date and time when the prices of the items in the cart were last updated/refreshed
    lastPriceUpdate: Date,
  },
  {
    // Automatically add 'createdAt' and 'updatedAt' timestamp fields to the document
    timestamps: true,
    // Ensure virtual properties (like total and itemCount) are included when converting to JSON
    toJSON: { virtuals: true },
    // Ensure virtual properties are included when converting to standard JavaScript objects
    toObject: { virtuals: true },
  }
);

// Create a virtual property to calculate the total price of all items in the cart
cartSchema.virtual('total').get(function () {
  // If there are no items, the total price is 0
  if (!this.items || this.items.length === 0) return 0;
  // Sum up the prices of all items in the items array (using 0 if price is undefined)
  return this.items.reduce((sum, item) => sum + (item.price || 0), 0);
});

// Create a virtual property to get the count of items in the cart
cartSchema.virtual('itemCount').get(function () {
  // Return the length of the items array, or 0 if the array does not exist
  return this.items ? this.items.length : 0;
});

// Instance method on the cart document to add a new item
cartSchema.methods.addItem = async function (itemData) {
  // Check if an item with the exact same ID and type is already present in the cart
  const exists = this.items.some(
    (item) => item.type === itemData.type && item.itemId.toString() === itemData.itemId.toString()
  );

  // If the item is already in the cart, throw a 400 Bad Request error
  if (exists) {
    const AppError = require('../utils/AppError');
    throw new AppError("L'article existe déjà dans le panier !", 400);
  }

  // Push the new item data into the items array
  this.items.push(itemData);
  // Save the updated cart document to the database
  await this.save();
};

// Instance method on the cart document to remove a specific item using its unique cart item ID
cartSchema.methods.removeItem = async function (itemId) {
  // Keep only the items that do not match the given item ID
  this.items = this.items.filter((item) => item._id.toString() !== itemId);
  // Save the updated cart document to the database
  await this.save();
};

// Instance method on the cart document to empty all items
cartSchema.methods.clear = async function () {
  // Reset the items array to empty
  this.items = [];
  // Save the updated cart document to the database
  await this.save();
};

// Instance method to update and refresh the prices and titles of all items in the cart from the database
cartSchema.methods.refreshPrices = async function () {
  // Dynamically import the database models to query current data
  const Photo = require('./Photo');
  const Pack = require('./Pack');
  const Content = require('./Content');

  // Loop through each item in the cart to fetch its latest price and details
  for (const item of this.items) {
    let Model;
    // Determine which database collection/model to query based on the item type
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

    // If a valid model was found for the item type
    if (Model) {
      // Query the database for the item document using its ID
      const doc = await Model.findById(item.itemId);
      // If the item still exists in the database
      if (doc) {
        // Refresh the title of the item
        item.title = doc.title;
        
        // Refresh the price based on the item type and selected license type
        if (item.type === 'photo') {
          if (item.licenseType === 'commercial') {
            item.price = doc.priceCommercialTND || 0;
          } else {
            item.price = doc.pricePersonalTND || doc.priceTND || 0;
          }
        } else if (item.type === 'content') {
          if (item.licenseType === 'commercial') {
            item.price = doc.priceCommercial || 0;
          } else {
            item.price = doc.pricePersonal || doc.price || 0;
          }
        } else {
          item.price = doc.priceTND || doc.price || 0;
        }
      }
    }
  }

  // Set the last price update timestamp to the current date and time
  this.lastPriceUpdate = new Date();
  // Save all price updates to the database
  await this.save();
};

// Static method on the Cart model to find a user's cart or create a new one if it doesn't exist
cartSchema.statics.getOrCreate = async function (userId) {
  // Find a cart document belonging to the given user ID
  let cart = await this.findOne({ userId });

  // If no cart is found for the user, create a new, empty cart
  if (!cart) {
    cart = await this.create({ userId, items: [] });
  }

  // Return the found or newly created cart document
  return cart;
};

// Create the 'Cart' model using the defined schema
const Cart = mongoose.model('Cart', cartSchema);

// Export the Cart model for use in other files
module.exports = Cart;
