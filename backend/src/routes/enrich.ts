import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { entities, prompt } = req.body;
    
    if (!entities || !Array.isArray(entities) || !prompt) {
      return res.status(400).json({ error: 'Missing entities or prompt' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const uniqueItems = Array.from(new Set(entities)).slice(0, 20);
    
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
    res.status(500).json({ error: error.message || 'Enrichment failed' });
  }
});

export default router;
