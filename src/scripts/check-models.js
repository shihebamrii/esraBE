require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  try {
    // Note: listModels is not directly on genAI in some versions, but let's try the common way
    // Actually, in @google/generative-ai, you usually don't list models this way.
    // Let's try to just test gemini-1.5-flash-latest
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('Testing gemini-1.5-flash...');
    const result = await model.generateContent('Hello');
    console.log('Success with gemini-1.5-flash');
  } catch (e) {
    console.log('Failed with gemini-1.5-flash:', e.message);
    
    try {
      console.log('Testing gemini-1.5-flash-latest...');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const result = await model.generateContent('Hello');
      console.log('Success with gemini-1.5-flash-latest');
    } catch (e2) {
      console.log('Failed with gemini-1.5-flash-latest:', e2.message);
      
      try {
        console.log('Testing gemini-pro-vision...');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
        const result = await model.generateContent('Hello');
        console.log('Success with gemini-pro-vision');
      } catch (e3) {
        console.log('All standard models failed.');
      }
    }
  }
}

listModels();
