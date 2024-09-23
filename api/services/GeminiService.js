import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLEAI_API_KEY);

const GeminiService = {
  getTextModel: () => {
    return genAI.getGenerativeModel({ model: 'gemini-pro' });
  },
  getTextAndImageModel: () => {
    return genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
  }
};

export default GeminiService;