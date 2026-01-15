import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { chargeCredits, InsufficientCreditsError } from '../utils/credits.js';

const router = express.Router();

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { query, fileContext } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error('ERROR: GEMINI_API_KEY is not set or is empty');
      return res.status(500).json({ error: 'Service is not configured.' });
    }

    // Charge credits (20 credits per analysis, matches frontend)
    await chargeCredits(req.user.id, 20);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Input validation
    if (!query || !fileContext) {
      return res.status(400).json({ error: 'Missing query or fileContext' });
    }

    if (typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query must be a non-empty string' });
    }

    if (query.length > 500) {
      return res.status(400).json({ error: 'Query too long (max 500 characters)' });
    }

    if (typeof fileContext !== 'string' || fileContext.length > 50000) {
      return res.status(400).json({ error: 'File context too large (max 50KB)' });
    }

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 60000)
    );

    const systemInstruction = `
            You are a senior financial analyst engine. 
            Map the user's question to an INTENT and generate data for the appropriate cards.

            MAPPING RULES:
            - "What changed?" -> INTENT: SUMMARY
            - "Why did this drop/change?" -> INTENT: CHANGE_EXPLANATION (Requires 'buckets')
            - "Who caused this?" / "Explain by customer/region" -> INTENT: DIMENSION_ANALYSIS (Requires 'drivers')
            - "Can I trust this?" / "Data quality" -> INTENT: SANITY_CHECK (Requires 'sanity')
            
            OUTPUT JSON FORMAT:
            {
              "intent": "SUMMARY" | "CHANGE_EXPLANATION" | "DIMENSION_ANALYSIS" | "SANITY_CHECK",
              "title": "Short descriptive title",
              "metrics": {
                "oldLabel": "Old", "oldValue": "100",
                "newLabel": "New", "newValue": "120",
                "delta": "+20", "percent": "+20%", "isNegative": false
              },
              "explanation": "Clear text explanation.",
              "buckets": [],
              "drivers": [],
              "sanity": {},
              "followUps": ["Question 1", "Question 2"]
            }

            CONTEXT:
            ${fileContext}
        `;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction,
      generationConfig: { responseMimeType: "application/json" }
    });

    const analysisPromise = model.generateContent(`User Query: ${query}`);
    const result = await Promise.race([analysisPromise, timeoutPromise]) as any;
    const response = await result.response;
    const text = response.text() || "{}";
    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      json = { intent: "SUMMARY", title: "Analysis", explanation: text, metrics: {}, drivers: [], buckets: [], followUps: [] };
    }

    if (!json.drivers) json.drivers = [];
    if (!json.buckets) json.buckets = [];
    if (!json.followUps) json.followUps = [];
    
    res.json(json);
  } catch (error: any) {
    console.error('Analysis error:', error);

    if (error instanceof InsufficientCreditsError) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: error.required,
        available: error.available,
      });
    }

    res.status(500).json({ 
      error: error.message || 'Analysis failed',
      timeout: error.message?.includes('timeout') || false
    });
  }
});

export default router;
