const { Content, Pack, UserPack } = require('../models');

/**
 * Automatically runs necessary database migrations and cleanups on server startup.
 * Idempotent, safe, and zero-command!
 */
const runAutomaticMigrations = async () => {
  try {
    console.log('🔄 Running automatic database migrations...');

    // 1. Clean up "Welcome Pack" and legacy UserPack records
    const welcomePack = await Pack.findOne({ 
      $or: [
        { code: 'welcome' },
        { code: 'welcome-pack' },
        { title: /Welcome Pack/i },
        { description: /Welcome Pack/i }
      ]
    });

    if (welcomePack) {
      console.log(`🧹 Found legacy Welcome Pack in database (ID: ${welcomePack._id}). Deleting pack and associated UserPack subscriptions...`);
      
      // Delete all UserPack items that reference this Welcome Pack
      const userPackDeletion = await UserPack.deleteMany({ pack: welcomePack._id });
      console.log(`   - Deleted ${userPackDeletion.deletedCount} legacy user welcome pack subscription(s).`);
      
      // Delete the Welcome Pack itself
      await Pack.findByIdAndDelete(welcomePack._id);
      console.log('   - Welcome Pack deleted successfully.');
    } else {
      // Also do a clean up of any UserPack referencing a deleted/non-existent pack with welcome code
      const orphanUserPacks = await UserPack.find({}).populate('packId');
      const welcomeUserPacksToDelete = orphanUserPacks.filter(up => !up.packId || up.packId.code === 'welcome' || up.packId.code === 'welcome-pack');
      
      if (welcomeUserPacksToDelete.length > 0) {
        console.log(`   - Found ${welcomeUserPacksToDelete.length} orphaned welcome UserPacks. Cleaning them up...`);
        for (const up of welcomeUserPacksToDelete) {
          await UserPack.findByIdAndDelete(up._id);
        }
        console.log('   - Orphaned welcome UserPacks cleaned up.');
      }
    }

    // 2. Synchronize "rights" field for priced Content items (rights: "free" -> "paid")
    const pricedContents = await Content.find({
      rights: 'free',
      $or: [
        { price: { $gt: 0 } },
        { pricePersonal: { $gt: 0 } },
        { priceCommercial: { $gt: 0 } }
      ]
    });

    if (pricedContents.length > 0) {
      console.log(`🧹 Found ${pricedContents.length} priced Content documents with rights="free". Updating to rights="paid"...`);
      for (const doc of pricedContents) {
        doc.rights = 'paid';
        await doc.save({ validateBeforeSave: false });
        console.log(`   - Updated Content: "${doc.title}" to rights="paid"`);
      }
    }

    console.log('✅ Automatic database migrations completed successfully!');
  } catch (error) {
    console.error('❌ Failed to run automatic database migrations:', error.message);
  }
};

module.exports = {
  runAutomaticMigrations
};
