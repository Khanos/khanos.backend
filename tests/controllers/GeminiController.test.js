const request = require('supertest');
const fs = require("fs");
const express = require('express');
const multer  = require('multer')
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 2000000 /* 1MB */}
});
const GeminiController = require('../../api/controllers/GeminiController');
const GeminiService = require('../../api/services/GeminiService');
const exp = require('constants');
const app = express();

app.get('/gemini/getFromText', GeminiController.getTextFromPrompt);
app.post('/gemini/getFromImage', upload.single('image'), GeminiController.getTextFromImage);

describe('GeminiController', () => {
  beforeEach(() => {
    jest.spyOn(GeminiService, 'getTextModel').mockImplementation(() => {
      return {
        generateContent: () => {
          return {
            response: {
              text: () => 'test'
            }
          };
        }
      };
    });

    jest.spyOn(GeminiService, 'getTextAndImageModel').mockImplementation(() => {
      return {
        generateContent: () => {
          return {
            response: {
              text: () => 'test'
            }
          };
        }
      };
    });
  });
  describe('.getTextFromPrompt', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return 400 if prompt is not provided', async () => {
      const res = await request(app).get('/gemini/getFromText');
      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({ error: 'Prompt is required' });
    });
    
    it('should return 500 if there is an internal server error', async () => {
      jest.spyOn(GeminiService, 'getTextModel').mockImplementation(() => {
        console.log('error')
        throw new Error('Internal server error');
      });

      const prompt = 'test';
      const res = await request(app).get(`/gemini/getFromText?prompt=${prompt}`);
      expect(res.statusCode).toEqual(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });

    it('should return text from a given prompt', async () => {
      const res = await request(app).get('/gemini/getFromText?prompt=test');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('test');
    });
  });

  describe('.getTextFromImage', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return 400 if prompt is not provided', async () => {
      const res = await request(app).post('/gemini/getFromImage').type('form');
      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({ error: 'Prompt is required' });
    });

    it('should return 400 if image is not provided', async () => {
      const res = await request(app)
        .post('/gemini/getFromImage')
        .field('prompt', 'test');
      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({ error: 'Image is required' });
    });
    
    it('should return 500 if there is an internal server error', async () => {
      jest.spyOn(GeminiService, 'getTextAndImageModel').mockImplementation(() => {
        throw new Error('Internal server error');
      });

      const res = await request(app).post('/gemini/getFromImage')
        .field('prompt', 'test')
        .attach('image', 'tests/fixtures/image.png');
      expect(res.statusCode).toEqual(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });

    it('should return text from a given prompt and image', async () => {
      const res = await request(app)
        .post('/gemini/getFromImage')
        .field('prompt', 'test')
        .attach('image', 'tests/fixtures/image.png');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('test');
    });
  });
});
