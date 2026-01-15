import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { chargeCredits, InsufficientCreditsError } from '../utils/credits.js';

const router = express.Router();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { entities, prompt } = req.body;
    
    if (!entities || !Array.isArray(entities) || !prompt) {
      return res.status(400).json({ error: 'Missing entities or prompt' });
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error('ERROR: GEMINI_API_KEY is not set or is empty');
      return res.status(500).json({ error: 'API key not configured. Please set GEMINI_API_KEY in your .env file.' });
    }

    // Charge credits (25 credits per call, matches frontend)
    await chargeCredits(req.user.id, 25);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const uniqueItems = Array.from(new Set(entities)).slice(0, 100); // Increased limit to 100 per batch
    
    const systemPrompt = `
      You are a Data Enrichment Engine.
      User wants to know: "${prompt}"
      For the provided list of entities.
      
      Return a JSON object where keys are the entity names and values are the requested info.
      Example: { "Apple": "Tim Cook", "Microsoft": "Satya Nadella" } or { "Apple": {"ceo": "Tim Cook", "hq": "Cupertino"} }
      
      Entities: ${JSON.stringify(uniqueItems)}
    `;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error('No response from API');
    }

    const parsedResult = JSON.parse(text);
    res.json({ result: parsedResult });
    
  } catch (error: any) {
    console.error('Enrichment error:', error);

    if (error instanceof InsufficientCreditsError) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: error.required,
        available: error.available,
      });
    }
    
    // Provide user-friendly error messages
    let errorMessage = error.message || 'Enrichment failed';
    if (error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID')) {
      errorMessage = 'Invalid API key. Please check your GEMINI_API_KEY in the .env file.';
    } else if (error.message?.includes('API key')) {
      errorMessage = 'API key error. Please verify your GEMINI_API_KEY is set correctly.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
