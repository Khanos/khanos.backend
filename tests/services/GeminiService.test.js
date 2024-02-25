require('dotenv').config();
const GeminiService = require('../../api/services/GeminiService');

describe('GeminiService', () => {
  describe('getTextModel', () => {
    it('should return the text model', async () => {
      const textModel = await GeminiService.getTextModel();
      expect(textModel).toBeDefined();
      expect(textModel).toHaveProperty('model');
      expect(textModel.model).toBe('models/gemini-pro');
    });
  });
  describe('getTextAndImageModel', () => {
    it('should return the text and image model', async () => {
      const textAndImageModel = await GeminiService.getTextAndImageModel();
      expect(textAndImageModel).toBeDefined();
      expect(textAndImageModel).toHaveProperty('model');
      expect(textAndImageModel.model).toBe('models/gemini-pro-vision');
    });
  });
});