import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

router.post('/', async (req, res) => {
  try {
    const { entities, prompt } = req.body;
    
    // Input validation
    if (!entities || !Array.isArray(entities) || !prompt) {
      return res.status(400).json({ error: 'Missing entities or prompt' });
    }

    if (entities.length === 0) {
      return res.status(400).json({ error: 'Entities array cannot be empty' });
    }

    if (entities.length > 100) {
      return res.status(400).json({ error: 'Too many entities (max 100)' });
    }

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt must be a non-empty string' });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Prompt too long (max 1000 characters)' });
    }

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 60000)
    );

    const systemPrompt = `Enrich entities: ${JSON.stringify(entities)}. Query: ${prompt}. Return JSON object { entity: info }.`;

    const enrichmentPromise = ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [{ text: systemPrompt }] },
      config: { responseMimeType: "application/json", tools: [{googleSearch: {}}] }
    });

    const response = await Promise.race([enrichmentPromise, timeoutPromise]) as any;
    
    const result = JSON.parse(response.text || "{}");
    
    res.json({ result });
  } catch (error: any) {
    console.error('Enrichment error:', error);
    res.status(500).json({ 
      error: error.message || 'Enrichment failed',
      timeout: error.message?.includes('timeout') || false
    });
  }
});

export default router;
