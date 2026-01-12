import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
// Note: genAI instance will be created per request to ensure fresh API key

router.post('/', async (req, res) => {
  try {
    const { file, fields, fileType } = req.body;
    
    // Check if API key is set
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error('ERROR: GEMINI_API_KEY is not set or is empty');
      return res.status(500).json({ 
        error: 'API key not configured. Please set GEMINI_API_KEY in your .env file.' 
      });
    }
    
    // Create genAI instance per request to ensure it's using the right one
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Input validation
    if (!file || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ error: 'Missing file or fields' });
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Fields array cannot be empty' });
    }

    if (fields.length > 50) {
      return res.status(400).json({ error: 'Too many fields (max 50)' });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (fileType && !allowedMimeTypes.includes(fileType)) {
      return res.status(400).json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF' });
    }

    // Validate base64 file size (rough estimate: base64 is ~33% larger than binary)
    const base64Size = Buffer.from(file, 'base64').length;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (base64Size > maxSize) {
      return res.status(400).json({ error: 'File too large (max 10MB)' });
    }

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 60000)
    );

    const prompt = `Extract only these fields: ${fields.join(', ')}. Return JSON array of objects { key, value, confidence, box2d: [ymin, xmin, ymax, xmax] }.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const extractionPromise = model.generateContent([
      {
        inlineData: {
          mimeType: fileType || 'image/jpeg',
          data: file
        }
      },
      prompt
    ]);

    const result = await Promise.race([extractionPromise, timeoutPromise]) as any;
    const response = await result.response;
    const text = response.text() || "[]";
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "[]";
    
    let extractedFields = [];
    try {
      extractedFields = JSON.parse(jsonStr).map((f: any) => ({
        ...f,
        confidence: f.confidence || 0.9,
        flagged: false
      }));
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      extractedFields = [];
    }
    
    res.json({ fields: extractedFields });
  } catch (error: any) {
    console.error('Extraction error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Extraction failed';
    let statusCode = 500;
    
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('Quota exceeded') || error.message?.includes('Too Many Requests')) {
      statusCode = 429;
      errorMessage = `API quota exceeded. You've reached your daily limit. Please wait or upgrade your plan.`;
    } else if (error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID')) {
      errorMessage = 'Invalid API key. Please check your GEMINI_API_KEY in the .env file.';
    } else if (error.message?.includes('API key')) {
      errorMessage = 'API key error. Please verify your GEMINI_API_KEY is set correctly.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
    } else {
      errorMessage = error.message || 'Extraction failed';
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      timeout: error.message?.includes('timeout') || false,
      quotaExceeded: statusCode === 429
    });
  }
});

export default router;
