import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';

// Initialize Sentry before anything else
import './utils/sentry.js';

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

// Validate required environment variables
if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

// Import middleware early (before app.use)
const { authenticate } = await import('./middleware/auth.js');
const { rateLimit } = await import('./middleware/rateLimit.js');
const { requestIdMiddleware } = await import('./middleware/requestId.js');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// DodoPayments webhook must use raw body (before express.json consumes it)
app.post(
  '/api/payment/webhook/dodo',
  express.raw({ type: 'application/json' }),
  rateLimit({ keyPrefix: 'dodo-webhook', windowMs: 60_000, max: 200 }),
  async (req, res, next) => {
    const { handleDodoWebhook } = await import('./routes/payment.js');
    return handleDodoWebhook(req, res);
  }
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request ID middleware (must be before routes)
app.use(requestIdMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes AFTER env is loaded (prevents import-time env issues)
const [
  { default: extractRoutes },
  { default: analyzeRoutes },
  { default: enrichRoutes },
  { default: chatRoutes },
  { default: authRoutes },
  { default: adminRoutes },
  { default: paymentRoutes },
  { default: workflowRoutes },
] = await Promise.all([
  import('./routes/extract.js'),
  import('./routes/analyze.js'),
  import('./routes/enrich.js'),
  import('./routes/chat.js'),
  import('./routes/auth.js'),
  import('./routes/admin.js'),
  import('./routes/payment.js'),
  import('./routes/workflows.js'),
]);

// Public: signup welcome email (no auth - user has no session until email confirmed)
const { sendWelcomeEmail } = await import('./utils/email.js');
app.post('/api/auth/signup-welcome-email', rateLimit({ keyPrefix: 'signup-email', windowMs: 60_000, max: 5 }), async (req, res) => {
  try {
    const { email, name } = req.body || {};
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    const displayName = (name && typeof name === 'string' ? name : 'User').trim() || 'User';
    console.log('[signup-welcome-email] Sending to:', email);
    const success = await sendWelcomeEmail(email.trim(), displayName);
    if (success) {
      console.log('[signup-welcome-email] Sent successfully to:', email);
      return res.json({ message: 'Welcome email sent' });
    }
    console.error('[signup-welcome-email] Failed to send to:', email);
    return res.status(500).json({ error: 'Failed to send welcome email' });
  } catch (err: any) {
    console.error('[signup-welcome-email] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send' });
  }
});

// Payment webhooks (no auth)
app.post('/api/payment/webhook', rateLimit({ keyPrefix: 'payment-webhook', windowMs: 60_000, max: 100 }), async (req, res) => {
  res.status(200).send('OK');
});

// Routes (all protected with authentication)
app.use('/api/extract', authenticate, rateLimit({ keyPrefix: 'extract', windowMs: 60_000, max: 10 }), extractRoutes);
app.use('/api/analyze', authenticate, rateLimit({ keyPrefix: 'analyze', windowMs: 60_000, max: 20 }), analyzeRoutes);
app.use('/api/enrich', authenticate, rateLimit({ keyPrefix: 'enrich', windowMs: 60_000, max: 30 }), enrichRoutes);
app.use('/api/chat', authenticate, rateLimit({ keyPrefix: 'chat', windowMs: 60_000, max: 30 }), chatRoutes);
app.use('/api/auth', authenticate, authRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/payment', authenticate, rateLimit({ keyPrefix: 'payment', windowMs: 60_000, max: 20 }), paymentRoutes);
app.use('/api/workflows', authenticate, rateLimit({ keyPrefix: 'workflows', windowMs: 60_000, max: 30 }), workflowRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.aborted') {
    console.warn(`[request] body stream aborted for ${req.method} ${req.originalUrl}`);
    return res.status(400).send('Request aborted');
  }
  return next(err);
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

server.on('error', (err: any) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use.`);
    console.error(`Fix: stop the other process using port ${PORT}, or change PORT in your backend .env (or system env).`);
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});
