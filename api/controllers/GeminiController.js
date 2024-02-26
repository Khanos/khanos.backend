const GeminiService = require('../services/GeminiService');
const fs = require("fs");

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

const GeminiController = {
  getTextFromPrompt: async (req, res) => {
    try {
      const { prompt } = req.query;
      if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

      const textModel = GeminiService.getTextModel();
      const result = await textModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      res.send(text);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  getTextFromImage: async (req, res) => {
    try {
      const { prompt = null } = req.body ?? {};
      const { file = null } = req;
      if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
      if (!file) return res.status(400).json({ error: 'Image is required' });

      const filePath = file.destination + file.filename;
      const imageParts = [
        fileToGenerativePart(filePath, file.mimetype),
      ];

      const textAndImageModel = GeminiService.getTextAndImageModel();
      const result = await textAndImageModel.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      fs.unlink(filePath, () => {
        console.log('File deleted successfully');
      });
      
      res.send(text);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  getTextFromChat: async (req, res) => {
    try {
      const { prompt } = req.params;
      /* istanbul ignore next */
      if(!req.session.chatHistory) {
        req.session.chatHistory = [];
      }
      const textModel = GeminiService.getTextModel();
      const chat = textModel.startChat({
        history: req.session.chatHistory,
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();
      req.session.chatHistory.push({
        role: 'user',
        parts: [{
          text: prompt,
        }],
      });
      req.session.chatHistory.push({
        role: 'model',
        parts: [{
          text: text,
        }],
      });
      res.send(text);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = GeminiController;