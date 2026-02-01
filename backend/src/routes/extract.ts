import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { chargeCredits, InsufficientCreditsError } from '../utils/credits.js';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../utils/logger.js';

const router = express.Router();

// Normalize box2d to 0-1000 scale (model may return pixels or 0-1)
function normalizeBox2d(box: number[] | undefined, imgWidth?: number, imgHeight?: number): number[] | undefined {
  if (!box || box.length !== 4) return undefined;
  const [ymin, xmin, ymax, xmax] = box;
  const maxVal = Math.max(ymin, xmin, ymax, xmax);
  if (maxVal <= 1) return [ymin * 1000, xmin * 1000, ymax * 1000, xmax * 1000];
  if (imgWidth && imgHeight && maxVal > 1) {
    return [
      (ymin / imgHeight) * 1000,
      (xmin / imgWidth) * 1000,
      (ymax / imgHeight) * 1000,
      (xmax / imgWidth) * 1000,
    ];
  }
  return box;
}

// Validate and normalize numeric string
function normalizeNumeric(val: string): string {
  if (val == null || val === '') return '';
  const s = String(val).replace(/[^\d.-]/g, '').trim();
  return s || '';
}

// Validate date; return confidence 0.5 and flagged if invalid
function validateDate(val: string): { value: string; confidence: number; flagged: boolean } {
  if (val == null || val === '') return { value: '', confidence: 0, flagged: true };
  const s = String(val).trim();
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return { value: s, confidence: 0.5, flagged: true };
  return { value: s, confidence: 1, flagged: false };
}

router.post('/', async (req: AuthenticatedRequest, res) => {
  const logger = createLogger((req as any).requestId);
  try {
    const { file, fields, fileType, fileName, includeLineItems } = req.body;
    logger.info('Extract request received', { userId: req.user?.id, fileType, fileName, includeLineItems });

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      logger.error('GEMINI_API_KEY is not set or is empty');
      return res.status(500).json({ 
        error: 'API key not configured. Please set GEMINI_API_KEY in your .env file.' 
      });
    }

    // Store original document in Supabase Storage (avoid DB bloat)
    const storageUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documents';
    if (!storageUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Service is not configured.' });
    }

    const supabaseAdmin = createClient(storageUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const buffer = Buffer.from(file, 'base64');
    const ext =
      typeof fileName === 'string' && fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() :
      fileType === 'application/pdf' ? 'pdf' :
      fileType === 'image/png' ? 'png' :
      fileType === 'image/webp' ? 'webp' : 'jpg';

    const objectPath = `${req.user.id}/${randomUUID()}.${ext || 'bin'}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType: fileType || 'application/octet-stream', upsert: false });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Provide specific error messages based on the error
      let storageErrorMessage = 'Failed to store document for review.';
      if (uploadError.message?.includes('Bucket not found') || (uploadError as any).statusCode === '404') {
        storageErrorMessage = `Storage bucket "${bucket}" not found. Please create it in Supabase Storage.`;
      } else if (uploadError.message?.includes('not allowed') || uploadError.message?.includes('permission')) {
        storageErrorMessage = 'Storage permission denied. Check your Supabase service role key.';
      } else if (uploadError.message) {
        storageErrorMessage = uploadError.message;
      }
      return res.status(500).json({ error: storageErrorMessage });
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

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 60000)
    );

    const fieldRules = [
      'Date: Use ISO 8601 (YYYY-MM-DD) or keep original if ambiguous.',
      'Total Amount, Tax Amount: Numeric only, no currency symbols; use . for decimals.',
      'Invoice Number, PO Number: Exact string as shown.',
      'Vendor Name: Full business name.',
      'For missing fields: use empty string and confidence 0. Do not guess.',
      'box2d: Normalized 0-1000 coordinates [ymin, xmin, ymax, xmax] as fraction of image dimensions.',
    ].join(' ');

    const basePrompt = `You are extracting data from an invoice or receipt document.
Extract only these header fields: ${fields.join(', ')}.
Rules: ${fieldRules}
Return strict JSON only, no markdown or explanation.`;

    const fullPrompt = includeLineItems
      ? `${basePrompt}
Also extract line items as array. Each line: description, quantity, unitPrice, lineTotal (numbers where possible).
Return JSON: { "fields": [ { "key", "value", "confidence", "box2d" } ], "lineItems": [ { "description", "quantity", "unitPrice", "lineTotal", "confidence" } ] }`
      : `${basePrompt}
Return JSON array: [ { "key", "value", "confidence", "box2d": [ymin, xmin, ymax, xmax] } ]`;

    const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let text = '';
    let lastError: Error | null = null;

    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const extractionPromise = model.generateContent([
          {
            inlineData: {
              mimeType: fileType || 'image/jpeg',
              data: file
            }
          },
          fullPrompt
        ]);

        const result = await Promise.race([extractionPromise, timeoutPromise]) as any;
        const response = result.response;

        if (!response || !response.candidates?.length) {
          const blockReason = (result.response?.promptFeedback || result.promptFeedback)?.blockReason || 'No candidates';
          const finishReason = response?.candidates?.[0]?.finishReason || 'unknown';
          throw new Error(`Gemini blocked or empty: ${blockReason}, finishReason=${finishReason}`);
        }

        text = response.text?.() || (response.candidates?.[0]?.content?.parts?.[0]?.text ?? '') || (includeLineItems ? '{}' : '[]');
        if (text) break;
      } catch (err: any) {
        lastError = err;
        logger.warn(`Extract failed with ${modelName}:`, { message: err.message, status: err.status });
        if (modelName === modelNames[modelNames.length - 1]) throw err;
      }
    }

    if (!text) {
      throw lastError || new Error('No response from Gemini');
    }
    
    let extractedFields: any[] = [];
    let lineItems: any[] = [];
    
    try {
      if (includeLineItems) {
        const objMatch = text.match(/\{[\s\S]*\}/);
        const objStr = objMatch ? objMatch[0] : '{}';
        const obj = JSON.parse(objStr);
        extractedFields = Array.isArray(obj.fields) ? obj.fields : [];
        lineItems = Array.isArray(obj.lineItems) ? obj.lineItems : [];
      } else {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : '[]';
        extractedFields = JSON.parse(jsonStr);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(500).json({ error: 'Extraction failed: invalid response from AI.' });
    }

    const numericKeys = ['Total Amount', 'Tax Amount', 'total', 'tax', 'amount'];
    const dateKeys = ['Date', 'Invoice Date', 'Transaction Date', 'date'];

    extractedFields = extractedFields.map((f: any) => {
      let value = f.value ?? '';
      let confidence = typeof f.confidence === 'number' ? f.confidence : 0.9;
      let flagged = !!f.flagged;
      const key = (f.key || '').trim();

      if (numericKeys.some(n => key.toLowerCase().includes(n.toLowerCase()))) {
        value = normalizeNumeric(value);
      }
      if (dateKeys.some(d => key.toLowerCase().includes(d.toLowerCase()))) {
        const vd = validateDate(value);
        value = vd.value;
        if (vd.flagged) { confidence = vd.confidence; flagged = true; }
      }
      const box2d = normalizeBox2d(f.box2d);
      return {
        ...f,
        key: key || f.key,
        value,
        confidence,
        flagged,
        box2d
      };
    });

    lineItems = lineItems.map((li: any) => ({
      description: String(li.description ?? '').trim(),
      quantity: typeof li.quantity === 'number' ? li.quantity : normalizeNumeric(String(li.quantity ?? '')) || 0,
      unitPrice: typeof li.unitPrice === 'number' ? li.unitPrice : normalizeNumeric(String(li.unitPrice ?? '')) || 0,
      lineTotal: typeof li.lineTotal === 'number' ? li.lineTotal : normalizeNumeric(String(li.lineTotal ?? '')) || 0,
      confidence: typeof li.confidence === 'number' ? li.confidence : 0.9,
    }));

    try {
      await chargeCredits(req.user.id, 100);
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
    
    res.json({ 
      fields: extractedFields, 
      lineItems: includeLineItems ? lineItems : undefined,
      fileRef: `storage:${bucket}/${objectPath}` 
    });
  } catch (error: any) {
    (logger || console).error?.('Extraction error', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      response: error?.response?.data,
    });

    if (error instanceof InsufficientCreditsError) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: error.required,
        available: error.available,
      });
    }
    
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
