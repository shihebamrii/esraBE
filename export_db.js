const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const MONGO_URI = 'mongodb://127.0.0.1:27017/mediatheque';
const EXPORT_DIR = path.join(__dirname, 'db_export');
const ZIP_PATH = path.join(__dirname, 'mediatheque_db.zip');

async function exportDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR);
    }

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections.`);

    for (let collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      // Skip chunks if you don't want to export huge files, but let's export them for completeness
      console.log(`Exporting collection: ${collectionName}`);
      const cursor = mongoose.connection.db.collection(collectionName).find({});
      const data = await cursor.toArray();
      fs.writeFileSync(path.join(EXPORT_DIR, `${collectionName}.json`), JSON.stringify(data, null, 2));
    }

    console.log('Creating zip archive...');
    const output = fs.createWriteStream(ZIP_PATH);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', function() {
      console.log(archive.pointer() + ' total bytes');
      console.log('Archiver has been finalized and the output file descriptor has closed.');
      console.log('Export zipped successfully to: ' + ZIP_PATH);
      process.exit(0);
    });

    archive.on('error', function(err) {
      throw err;
    });

    archive.pipe(output);
    archive.directory(EXPORT_DIR, false);
    archive.finalize();

  } catch (err) {
    console.error('Error exporting database:', err);
    process.exit(1);
  }
}

exportDatabase();
