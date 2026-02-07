import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { chargeCredits, InsufficientCreditsError } from '../utils/credits.js';

const router = express.Router();
// Note: genAI instance will be created per request to ensure fresh API key

router.post('/stream', async (req: AuthenticatedRequest, res) => {
  try {
    const { prompt, fileContext, history, isDataMode, retryOnError } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if API key is set
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey.trim() === '') {
      console.error('ERROR: GEMINI_API_KEY is not set or is empty');
      return res.status(500).json({ 
        error: 'Service is not configured.'
      });
    }
    
    // Recreate genAI instance with current API key to ensure it's using the right one
    const genAI = new GoogleGenerativeAI(apiKey);
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Charge credits before streaming starts (3 credits per chat message)
    // Skip charge when retryOnError: user is retrying after a code execution failure
    let creditsCharged = false;
    try {
      if (!retryOnError) {
        await chargeCredits(req.user.id, 3);
        creditsCharged = true;
      }
    } catch (error: any) {
      if (error instanceof InsufficientCreditsError) {
        return res.status(402).json({
          error: 'Insufficient credits',
          required: error.required,
          available: error.available,
        });
      }
      throw error;
    }

    const systemInstruction = isDataMode ? `
                You are an expert Data Analyst JavaScript Engine.
                
                AVAILABLE DATASETS (Context Provided): 
                ${fileContext}
                
                YOUR TASK:
                Write pure JavaScript code to answer the user's question accurately.
                The code will be executed in a secure worker with full access to the actual dataset.
                
                HELPER FUNCTIONS (Use these for precision):
                - findCol('name'): Returns column index (fuzzy match).
                - getNumCol('name'): Returns array of CLEANED numbers from a column.
                - getColData('name'): Returns array of raw values.
                
                CRITICAL RULES:
                1. ALWAYS wrap your code in \`\`\`javascript code blocks.
                2. ALWAYS include a return statement that returns the actual calculated result.
                3. For calculations: Return the numeric value, NOT text explanations.
                4. ALWAYS use 'getNumCol' for math operations.
                5. Round all monetary/float results to 2 decimals.
                6. Example for "total sum of all values":
                   \`\`\`javascript
                   const values = getNumCol('Value');
                   const total = values.reduce((sum, val) => sum + val, 0);
                   return total.toFixed(2);
                   \`\`\`
                7. DO NOT just explain - you MUST return executable code that calculates the result.
                8. CHARTING: Return { chartType: 'bar'|'line'|'pie', data: [{name: "Label", value: 123.45}, ...], title: "Chart Title" }
                9. FORMULAS: Return { data: <calc_result>, suggestedFormula: "=SUM(A:A)" }
                
                REMEMBER: Your response MUST include a \`\`\`javascript code block with executable code that returns the actual result.
                
                BREVITY: Before the code block write only 1-2 short sentences. Do not repeat the user's question. No intros like "Certainly" or "Here's the code".
                RESPONSE STYLE: Include impact when relevant (e.g. "That's $X extra cost" or "You could save $Y by...").
                End with exactly "Want me to:" then 2-3 concrete next steps that use their data (e.g. chart by X, sum of Y, compare Z). One per line. No generic suggestions.
            ` : `You are a data analyst assistant. Users have spreadsheet/invoice data. Answer in plain English.

Answer in 2-4 sentences. No intros like "Certainly!" or "Great question."
Direct answer, then impact when relevant ("That's $X extra cost" or "You could save $Y by...").
End with exactly "Want me to:" then 2-3 concrete next steps (charts, sums, comparisons). One per line. No generic suggestions.

CRITICAL: End every response with exactly this format for follow-ups:
Want me to:
- [Question 1]
- [Question 2]
- [Question 3]

Use 2-3 relevant follow-up questions based on the user's data and question.`;

    // Set up Server-Sent Events for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 120000) // 2 minutes for chat
    );

    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction,
        generationConfig: { temperature: 0.1, maxOutputTokens: 600 }
      });

      // Map history to the format expected by GoogleGenerativeAI
      // Filter and map history, ensuring it starts with a 'user' message
      let mappedHistory = (history || [])
        .filter((msg: any) => msg.content && msg.content.trim()) // Remove empty messages
        .slice(-10) // Take last 10 messages
        .map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content || '' }]
        }));

      // Ensure history starts with 'user' role (Google API requirement)
      // Remove any leading 'model' messages
      while (mappedHistory.length > 0 && mappedHistory[0].role === 'model') {
        mappedHistory = mappedHistory.slice(1);
      }

      // If no valid history (all were model messages or empty), use empty array
      if (mappedHistory.length === 0 || mappedHistory[0].role !== 'user') {
        mappedHistory = [];
      }

      const chat = model.startChat({
        history: mappedHistory
      });

      console.log('Starting stream...');
      
      // Wrap the streaming operation with timeout
      const streamPromise = (async () => {
        try {
          const result = await chat.sendMessageStream(prompt);
          console.log('Stream result received, starting to process chunks...');
          
          let chunkCount = 0;
          let hasContent = false;
          
          for await (const chunk of result.stream) {
            try {
              // Try to get text from chunk - handle different possible structures
              let chunkText = '';
              
              // Log chunk structure for debugging (first chunk only)
              if (chunkCount === 0) {
                console.log('First chunk structure:', JSON.stringify(Object.keys(chunk || {})));
                console.log('Chunk type:', typeof chunk);
              }
              
              // Method 1: Direct text() method (most common)
              try {
                if (typeof chunk.text === 'function') {
                  chunkText = chunk.text();
                } else if (chunk.text && typeof chunk.text === 'string') {
                  chunkText = chunk.text;
                }
              } catch (textError: any) {
                console.error('Error accessing chunk.text:', textError.message);
              }
              
              // Method 2: Access via candidates if text() didn't work
              if (!chunkText && chunk.candidates && chunk.candidates[0]?.content?.parts) {
                chunkText = chunk.candidates[0].content.parts
                  .map((part: any) => part.text || '')
                  .join('');
              }
              
              // Method 3: Try accessing response property if it exists
              if (!chunkText && (chunk as any).response) {
                const response = (chunk as any).response;
                if (response && typeof response.text === 'function') {
                  chunkText = response.text();
                } else if (response?.text) {
                  chunkText = response.text;
                }
              }
              
              if (chunkText && chunkText.trim()) {
                hasContent = true;
                chunkCount++;
                if (!res.writableEnded) {
                  res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
                }
              } else if (chunkCount === 0) {
                console.log('Empty chunk received, chunk keys:', Object.keys(chunk || {}));
                console.log('Chunk value:', JSON.stringify(chunk).substring(0, 200));
              }
            } catch (chunkError: any) {
              console.error('Chunk processing error:', chunkError.message || chunkError, chunkError.stack);
              // Continue processing other chunks
            }
          }
          
          console.log(`Stream completed. Sent ${chunkCount} chunks. Has content: ${hasContent}`);
          
          if (!hasContent && chunkCount === 0) {
            console.warn('WARNING: No content received from AI model');
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ error: 'No response received from AI model' })}\n\n`);
            }
          }
          
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
          }
        } catch (streamInnerError: any) {
          console.error('Inner stream error:', streamInnerError.message || streamInnerError, streamInnerError.stack);
          
          // Provide user-friendly error messages
          let errorMessage = 'Stream processing failed';
          if (streamInnerError.message?.includes('API key not valid') || streamInnerError.message?.includes('API_KEY_INVALID')) {
            errorMessage = 'Invalid API key. Please check your GEMINI_API_KEY in the .env file.';
          } else if (streamInnerError.message?.includes('API key')) {
            errorMessage = 'API key error. Please verify your GEMINI_API_KEY is set correctly.';
          } else {
            errorMessage = streamInnerError.message || 'Stream processing failed';
          }
          
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
            res.end();
          }
          throw streamInnerError;
        }
      })();

      await Promise.race([streamPromise, timeoutPromise]);
    } catch (streamError: any) {
      console.error('Stream error:', streamError);
      
      // Provide user-friendly error messages
      let errorMessage = 'Stream failed';
      if (streamError.message?.includes('API key not valid') || streamError.message?.includes('API_KEY_INVALID')) {
        errorMessage = 'Invalid API key. Please check your GEMINI_API_KEY in the .env file.';
      } else if (streamError.message?.includes('API key')) {
        errorMessage = 'API key error. Please verify your GEMINI_API_KEY is set correctly.';
      } else {
        errorMessage = streamError.message || 'Stream failed';
      }
      
      // Headers already set for SSE, send error via stream
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }
      
      // Make sure response is still writable before sending error
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      }
    }
  } catch (error: any) {
    console.error('Chat error:', error);

    if (error instanceof InsufficientCreditsError) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: error.required,
        available: error.available,
      });
    }

    // If headers not set yet, send JSON error
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error.message || 'Chat failed',
        timeout: error.message?.includes('timeout') || false
      });
    } else {
      // Headers already set, send via SSE
      res.write(`data: ${JSON.stringify({ error: error.message || 'Chat failed' })}\n\n`);
      res.end();
    }
  }
});

export default router;
