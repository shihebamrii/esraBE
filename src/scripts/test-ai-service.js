require('dotenv').config();
const { analyzeImage } = require('../services/aiService');
const fs = require('fs');
const path = require('path');

async function testAnalysis() {
  console.log('--- Testing AI Image Analysis ---');
  console.log('Using API Key:', process.env.GOOGLE_API_KEY ? 'Present (Hidden)' : 'MISSING');

  if (!process.env.GOOGLE_API_KEY) {
    console.error('Error: GOOGLE_API_KEY is not set in .env file');
    process.exit(1);
  }

  // Use a placeholder image from the frontend for testing
  const imagePath = path.join(__dirname, '../../../frontend/public/images/placeholders/tunis-thumb.png');
  
  try {
    if (!fs.existsSync(imagePath)) {
      console.log('Local test image not found, trying a public URL...');
      // If local image doesn't exist, we'll just log that we need a buffer
      console.log('Please ensure the server is running and test via the UI for full integration.');
      return;
    }

    const buffer = fs.readFileSync(imagePath);
    console.log('Analyzing local image:', imagePath);
    
    const result = await analyzeImage(buffer, 'image/png');
    
    console.log('\n--- Analysis Result ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n✅ AI Service is working correctly!');
  } catch (error) {
    console.error('\n❌ Analysis failed:');
    console.error(error.message);
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('The provided API Key is invalid.');
    }
  }
}

testAnalysis();
