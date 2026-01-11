import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

router.post('/stream', async (req, res) => {
  try {
    const { prompt, fileContext, history, isDataMode } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 120000) // 2 minutes for chat
    );

    const systemInstruction = isDataMode ? `
                You are an expert Data Analyst Python/JS Engine.
                
                AVAILABLE DATASETS (Context Provided): 
                ${fileContext}
                
                YOUR TASK:
                Write pure JavaScript code to answer the user's question accurately.
                The code will be executed in a secure worker with full access to the actual dataset.
                
                HELPER FUNCTIONS (Use these for precision):
                - findCol('name'): Returns column index (fuzzy match).
                - getNumCol('name'): Returns array of CLEANED numbers from a column.
                - getColData('name'): Returns array of raw values.
                
                RULES:
                1. ALWAYS use 'getNumCol' for math.
                2. Round all monetary/float results to 2 decimals.
                3. Return the FINAL RESULT.
                4. CHARTING:
                   - Return { chartType: 'bar'|'line'|'pie', data: [{name: "Label", value: 123.45}, ...], title: "Title" } ONLY if visualized data is best.
                5. FORMULAS:
                   - Return { data: <calc_result>, suggestedFormula: "=SUM(A:A)" } if asked.
                6. TEXT RESPONSE:
                   - ALWAYS explain your answer in the text response (before the code block).
            ` : "You are a helpful data assistant.";

    const recentHistory = (history || []).slice(-6).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Set up Server-Sent Events for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: [...recentHistory, { role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction, temperature: 0.1 },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (streamError: any) {
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: error.message || 'Chat failed',
      timeout: error.message?.includes('timeout') || false
    });
  }
});

export default router;
