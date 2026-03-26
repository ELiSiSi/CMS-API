import asyncHandler from 'express-async-handler';
import rateLimit from 'express-rate-limit';
import { UAParser } from 'ua-parser-js';

import User from '../models/modelUser.js';
import AppError from '../utils/appError.js';
import { verifyAccessToken } from '../controller/authController.js';

// ── Device Info ──────────────────────────────────────────────────────------------------------------
export const parseDeviceInfo = (req, _res, next) => {
  const ua = new UAParser(req.headers['user-agent']);
  const r = ua.getResult();

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';

  req.deviceInfo = {
    userAgent: req.headers['user-agent'] || 'unknown',
    ip,
    device: r.device.type || 'desktop',
    os: `${r.os.name || ''} ${r.os.version || ''}`.trim(),
    browser: `${r.browser.name || ''} ${r.browser.version || ''}`.trim(),
  };
  next();
};

// ── Protect ──────────────────────────────────────────────────────────
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer'))
    token = req.headers.authorization.split(' ')[1];
  else if (req.cookies?.access_token) token = req.cookies.access_token;

  if (!token) return next(new AppError('You are not logged in!', 401));

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    return next(
      new AppError(
        err.name === 'TokenExpiredError'
          ? 'Access token expired. Please refresh.'
          : 'Invalid token. Please log in again.',
        401
      )
    );
  }

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) return next(new AppError('User no longer exists.', 401));

  if (!currentUser.is_active)
    return next(new AppError('Your account is inactive.', 403));

  if (currentUser.changedPasswordAfter(decoded.iat))
    return next(
      new AppError('Password changed recently. Please log in again.', 401)
    );

  req.user = res.locals.user = currentUser;
  next();
});

// ── Restrict To ──────────────────────────────────────────────────────
export const restrictTo =(...roles) =>(req, res, next) => {
    const hasRole = req.user.roles.some((r) => roles.includes(r));
    if (!hasRole)
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    next();
  };

// ── Login  Limiter ───────────────────────────────────────────────--------------
export const loginRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress,
  handler: (_req, _res, next) =>
    next(
      new AppError(
        'Too many login attempts. Please try again in 15 minutes.',
        429
      )
    ),
});

// ── Global  Limiter ──────────────────────────────────────────────
export const globalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
