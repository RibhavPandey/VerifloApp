import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import extractRoutes from './routes/extract.js';
import analyzeRoutes from './routes/analyze.js';
import enrichRoutes from './routes/enrich.js';
import chatRoutes from './routes/chat.js';
import { authenticate } from './middleware/auth.js';

// Load .env file - try multiple locations
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try backend/.env first, then root .env
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  '.env'
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded .env from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env file found, using system environment variables');
  dotenv.config(); // Try default location
}

// Log API key status (without exposing the full key)
const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key Status:', {
  exists: !!apiKey,
  length: apiKey?.length || 0,
  preview: apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT SET'
});

// Validate required environment variables
if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - Never allow * in production
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development only
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In development, allow localhost on any port
    if (process.env.NODE_ENV === 'development' && origin && (
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:')
    )) {
      return callback(null, true);
    }
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS Error: Origin "${origin}" not allowed. Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes (all protected with authentication)
app.use('/api/extract', authenticate, extractRoutes);
app.use('/api/analyze', authenticate, analyzeRoutes);
app.use('/api/enrich', authenticate, enrichRoutes);
app.use('/api/chat', authenticate, chatRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
