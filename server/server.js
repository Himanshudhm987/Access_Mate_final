import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config();

// Initialize database
import db from './db.js';

// Import route handlers
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import documentRoutes from './routes/documents.js';
import systemRoutes from './routes/system.js';
import { csrfProtection } from './middleware/auth.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1' || isProd) {
  app.set('trust proxy', 1);
}

// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "http:", "https:"],
      connectSrc: ["'self'", "http:", "https:", "ws:", "blob:", "https://tessdata.projectnaptha.com"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = [
  ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

function isOriginAllowed(origin, host) {
  if (!origin || !isProd) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.hostname.endsWith('.onrender.com') || parsed.hostname.endsWith('.vercel.app')) {
      return true;
    }
    if (host && (parsed.host === host)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

app.disable('x-powered-by');

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Enforce valid origin for state-changing requests in production
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    const origin = req.headers.origin;
    if (!isOriginAllowed(origin, req.headers.host)) {
      return res.status(403).json({ error: 'Invalid request origin' });
    }
  }
  next();
});

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again later.' }
});

// Sensitive auth operations rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' }
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Optional CSRF protection for cookie-authenticated mutating requests
app.use('/api', csrfProtection);

// Mount API routes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'AccessMate Secure API',
    version: '2.5.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/system', systemRoutes);

// 404 handler for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Serve production static frontend if client/dist exists
const clientDist = join(__dirname, '../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Centralized error handler
app.use((err, req, res, _next) => {
  console.error(`[Error] ${req.method} ${req.url}:`, err.message || err);
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File size exceeds limit (maximum 25 MB).' });
    }
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = isProd && statusCode === 500
    ? 'Internal server error occurred.'
    : (err.message || 'Server error');

  res.status(statusCode).json({ error: message });
});

// Graceful shutdown logic
let serverInstance = null;

function shutdown() {
  console.log('\n[Server] Shutting down gracefully...');
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('[Server] HTTP connections closed.');
      try {
        db.pragma('optimize');
        console.log('[DB] SQLite closed.');
      } catch (e) {
        console.warn('[DB] Error during DB close:', e.message);
      }
      process.exit(0);
    });

    // Force shutdown if taking too long
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled promise rejection:', reason);
});

// Start listening only when run directly as main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`AccessMate API running at http://localhost:${PORT}`);
  });

  serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server Error] Port ${PORT} is already in use. Please check if another instance of AccessMate is running.`);
    } else {
      console.error('[Server Error]', err);
    }
  });
}

export default app;
