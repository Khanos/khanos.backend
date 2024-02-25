require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLEAI_API_KEY);

const GeminiService = {
  getTextModel: () => {
    return genAI.getGenerativeModel({ model: 'gemini-pro' });
  },
  getTextAndImageModel: () => {
    return genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
  }
};

module.exports = GeminiService;