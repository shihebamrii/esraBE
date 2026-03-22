/**
 * Seed membership packs script
 */

const mongoose = require('mongoose');
const { Pack, User } = require('./src/models');
const config = require('./src/config');

const seedPacks = async () => {
  try {
    await mongoose.connect(config.database.uri);
    console.log('Connected to MongoDB');

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('No admin user found to create packs. Run seed-users.js first.');
      process.exit(1);
    }

    const membershipPacks = [
      // TOUNESNA PACKS
      {
        title: 'Tounesna Silver',
        description: 'Pack Silver for Tounesna',
        type: 'membership',
        priceTND: 49,
        membershipFeatures: {
          photosLimit: 15,
          reelsLimit: 3,
          videosLimit: 1,
          quality: 'standard',
          module: 'tounesna'
        },
        createdBy: admin._id,
      },
      {
        title: 'Tounesna Gold',
        description: 'Pack Gold for Tounesna',
        type: 'membership',
        priceTND: 199,
        membershipFeatures: {
          photosLimit: 30,
          reelsLimit: 8,
          videosLimit: 3,
          documentariesLimit: 1,
          quality: 'hd',
          module: 'tounesna'
        },
        createdBy: admin._id,
      },
      {
        title: 'Tounesna Premium',
        description: 'Pack Premium for Tounesna',
        type: 'membership',
        priceTND: 499,
        membershipFeatures: {
          photosLimit: 60,
          reelsLimit: 15,
          videosLimit: 5,
          documentariesLimit: 2,
          quality: 'hd',
          module: 'tounesna'
        },
        createdBy: admin._id,
      },
      // IMPACT PACKS
      {
        title: 'Impact Silver',
        description: 'Pack Silver for Impact',
        type: 'membership',
        priceTND: 49,
        membershipFeatures: {
          reelsLimit: 3,
          videosLimit: 1, // storytelling
          quality: 'standard',
          module: 'impact'
        },
        createdBy: admin._id,
      },
      {
        title: 'Impact Gold',
        description: 'Pack Gold for Impact',
        type: 'membership',
        priceTND: 199,
        membershipFeatures: {
          reelsLimit: 8,
          videosLimit: 3, // storytelling
          documentariesLimit: 1,
          quality: 'hd',
          module: 'impact'
        },
        createdBy: admin._id,
      },
      {
        title: 'Impact Premium',
        description: 'Pack Premium for Impact',
        type: 'membership',
        priceTND: 499,
        membershipFeatures: {
          reelsLimit: 15,
          videosLimit: 5, // storytelling
          documentariesLimit: 2,
          quality: 'hd',
          module: 'impact'
        },
        createdBy: admin._id,
      },
      // WELCOME PACK
      {
        title: 'Welcome Pack',
        description: 'Free video for new users',
        type: 'membership',
        priceTND: 0,
        membershipFeatures: {
          photosLimit: 0,
          reelsLimit: 0,
          videosLimit: 1,
          documentariesLimit: 0,
          quality: 'standard',
          module: 'impact'
        },
        createdBy: admin._id,
      }
    ];

    for (const packData of membershipPacks) {
      await Pack.findOneAndUpdate(
        { title: packData.title },
        packData,
        { upsert: true, new: true }
      );
      console.log(`Pack created/updated: ${packData.title}`);
    }

    console.log('Membership packs seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding packs:', error);
    process.exit(1);
  }
};

seedPacks();
