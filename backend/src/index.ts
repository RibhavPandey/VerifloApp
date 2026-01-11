import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import extractRoutes from './routes/extract.js';
import analyzeRoutes from './routes/analyze.js';
import enrichRoutes from './routes/enrich.js';
import chatRoutes from './routes/chat.js';
import { authenticate } from './middleware/auth.js';

dotenv.config();

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
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development only
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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
