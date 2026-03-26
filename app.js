import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
//  Security Packages ─────────────────────────────────────────────────
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';

import AppError from './utils/appError.js';
import authRouter from './routes/authRouter.js';
import userRouter from './routes/userRouter.js';
import mediaRouter from './routes/mediaRouter.js';
import sessionRouter from './routes/sessionRouter.js';
import postsRouter from './routes/postsRouter.js';
import categoryRouter from './routes/categoryRouter.js';
import tagRouter from './routes/tagRouter.js';

const app = express();
const port = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;



// Helmet ──────────────────────────────────────────────────────────

app.use(helmet());

// Morgan ──────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

//Body Parser ────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie Parser ──────────────────────────────────────────────────
app.use(cookieParser());

// MongoDB Sanitize ───────────────────────────────────────────────
app.use(mongoSanitize());

// HPP ────────────────────────────────
app.use(
  hpp({
    whitelist: ['status', 'roles', 'sort'],
  })
);

// Compression ────────────────────────────────────────────────────
app.use(compression());

//Static Files ───────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use('/uploads', express.static(join(__dirname, 'uploads')));

//  Global Rate Limiter ────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    reason: 'TOO_MANY_REQUESTS',
    message_en: 'Too many requests from this IP, please try again later.',
  },
});


// ═══════════════════════════════════════════════════════════════════════
//---------------------------   ROUTES    ---------------------------------------------------------------------
// ═══════════════════════════════════════════════════════════════════════
app.use('/v1', globalLimiter);

-app.get('/v1/cms/ping', (req, res) => {
  res.json({
    ok: true,
    message: 'CMS API is active',
    user_id: req.user?._id || null,
    cms_db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/v1/auth', authRouter);
app.use('/v1/core/users', userRouter);
app.use('/v1/core/media', mediaRouter);
app.use('/v1/core/sessions', sessionRouter);
app.use('/v1/cms/posts', postsRouter);
app.use('/v1/cms/categories', categoryRouter);
app.use('/v1/cms/collections', categoryRouter);
app.use('/v1/cms/tags', tagRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  return res.status(err.statusCode).json({
    ok: false,
    reason: err.reason || 'SERVER_ERROR',
    message_en: err.message_en || err.message,
    message_fa: err.message_fa || err.message,
    message_ar: err.message_ar || err.message,
    ...(err.errors && { errors: err.errors }),
  });
});


process.on('unhandledRejection', (err) => {
  console.log(' Unhandled Rejection Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});


process.on('uncaughtException', (err) => {
  console.log(' Uncaught Exception  Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

//  CONNECT -----------------------------------
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(' Connected to MongoDB');
    app.listen(port, () => {
      console.log(` App listening at http://localhost:${port}`);
    });
  })
  .catch((err) => console.error('❌ MongoDB Error:', err));

export default app;
