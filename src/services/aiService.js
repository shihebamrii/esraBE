/**
 * AI Service / خدمة الذكاء الاصطناعي
 * هنا نتعاملو مع Gemini لتحليل الصور والدردشة
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

/**
 * تحليل صورة باستخدام Gemini Vision
 * @param {Buffer} buffer - الصورة
 * @param {string} mimeType - نوع الملف
 * @returns {Promise<Object>}
 */
const analyzeImage = async (buffer, mimeType = 'image/jpeg') => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `
      Analyze this image comprehensively. Provide:
      1. A detailed visual description.
      2. Identify the likely location (city, country, landmarks).
      3. Identify key objects, people, or activities.
      4. Suggest 3 relevant follow-up questions a user might ask.
      
      Format the response as a JSON object:
      {
        "description": "...",
        "location": {
          "likely": "...",
          "confidence": "high|medium|low",
          "landmarks": ["..."]
        },
        "tags": ["..."],
        "suggestedQuestions": ["..."]
      }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response (sometimes Gemini wraps it in ```json ... ```)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { description: text };
  } catch (error) {
    console.error('AI Analysis error:', error);
    throw new Error('Failed to analyze image with AI');
  }
};

/**
 * دردشة حول صورة معينة
 * @param {string} userMessage - رسالة المستخدم
 * @param {Buffer} buffer - الصورة (للسياق)
 * @param {string} mimeType - نوع الملف
 * @param {Array} history - سجل الدردشة
 * @returns {Promise<string>}
 */
const chatAboutImage = async (userMessage, buffer, mimeType = 'image/jpeg', history = []) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    let formattedHistory = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }],
    }));

    // Gemini requires the first message to be from the 'user'
    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.unshift({
        role: 'user',
        parts: [{ text: 'Please act as an AI Assistant and analyze the image I provide.' }],
      });
    }

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage([
      userMessage,
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      },
    ]);

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('AI Chat error:', error);
    throw new Error('Failed to get response from AI');
  }
};

module.exports = {
  analyzeImage,
  chatAboutImage,
};
