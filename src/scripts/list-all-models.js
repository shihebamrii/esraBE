require('dotenv').config();
const axios = require('axios');

async function listModels() {
  const apiKey = process.env.GOOGLE_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await axios.get(url);
    console.log('Available Models:');
    response.data.models.forEach(m => {
      console.log(`- ${m.name} (supports: ${m.supportedGenerationMethods.join(', ')})`);
    });
  } catch (e) {
    console.log('Error listing models:', e.response ? e.response.data : e.message);
  }
}

listModels();
