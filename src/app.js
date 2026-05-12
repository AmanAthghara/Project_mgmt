const express      = require('express');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');

const routes                    = require('./routes');
const { requestLogger, errorHandler, notFound } = require('./middlewares');
const logger                    = require('./utils/logger');

const app = express();
app.set('trust proxy', 1);
// ── CORS ──────────────────────────────────────────────────────
// In development allow the frontend dev server; in production
// set CORS_ORIGIN to your deployed frontend URL.
const corsOptions = {
  origin: (origin, callback) => {
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim());
    // allow requests with no origin (Postman, curl, mobile apps)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS', `Blocked request from origin: ${origin}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods:           ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:    ['Content-Type', 'Authorization'],
  exposedHeaders:    ['X-Total-Count'],
  credentials:       true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('/*splat', cors(corsOptions));

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Request logger (custom) ───────────────────────────────────
app.use(requestLogger);

// ── Global rate limiter ───────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  handler: (req, res, _next, options) => {
    logger.warn('RATE', `Rate limit hit: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json(options.message);
  },
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many auth attempts. Please wait 15 minutes.' },
  handler: (req, res, _next, options) => {
    logger.warn('RATE', `Auth rate limit hit: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json(options.message);
  },
});

app.use('/api',            globalLimiter);
app.use('/api/auth',       authLimiter);

// ── API routes ────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 + error handler ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
