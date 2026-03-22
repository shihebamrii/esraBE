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
        description: 'Ideal for small projects. Includes 15 professional photos of tourist sites, 3 reels, and 1 short presentation video. Standard quality access.',
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
        description: 'Most preferred choice. 30 professional photos, 8 reels, 3 presentation videos (village, landscape, activity), and 1 mini-reportage (2-3 min). HD quality access.',
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
        description: 'Complete digital heritage collection. 60 photos, 15 reels, 5 professional videos, 2 mini-reportages, and 1 cinematic promotion video. HD + Exclusive access.',
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
        description: 'Basic impact storytelling. 3 reels, 1 storytelling video, and 1 podcast interview. Standard quality.',
        type: 'membership',
        priceTND: 49,
        membershipFeatures: {
          reelsLimit: 3,
          videosLimit: 1, 
          podcastsLimit: 1,
          quality: 'standard',
          module: 'impact'
        },
        createdBy: admin._id,
      },
      {
        title: 'Impact Gold',
        description: 'Comprehensive storytelling. 8 reels, 3 storytelling videos, 2 podcasts, and 1 mini-documentary (3-5 min). HD quality.',
        type: 'membership',
        priceTND: 199,
        membershipFeatures: {
          reelsLimit: 8,
          videosLimit: 3,
          podcastsLimit: 2,
          documentariesLimit: 1,
          quality: 'hd',
          module: 'impact'
        },
        createdBy: admin._id,
      },
      {
        title: 'Impact Premium',
        description: 'Full marketing & orientation strategy. 15 reels, 5 storytelling videos, 3 podcasts, 2 mini-documentaries, and 1 complete success story series. HD quality.',
        type: 'membership',
        priceTND: 499,
        membershipFeatures: {
          reelsLimit: 15,
          videosLimit: 5,
          podcastsLimit: 3,
          documentariesLimit: 2,
          successStoryLimit: 1,
          quality: 'hd',
          module: 'impact'
        },
        createdBy: admin._id,
      },
      // WELCOME PACK
      {
        title: 'Welcome Pack',
        description: 'A gift for joining our vision. Includes 1 free video download from the Impact module.',
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
