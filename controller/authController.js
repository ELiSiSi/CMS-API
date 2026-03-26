import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import JWT from 'jsonwebtoken';
import qrcode from 'qrcode';
import speakeasy from 'speakeasy';
import ms from 'ms';

import Session from '../models/modelSession.js';
import User from '../models/modelUser.js';
import AppError from '../utils/appError.js';

// ── Token  ────────────────────────────────────────────────────
export const signAccessToken = (payload) =>
  JWT.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });

export const verifyAccessToken = (token) =>
  JWT.verify(token, process.env.JWT_ACCESS_SECRET);

export const signRefreshToken = (payload) =>
  JWT.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

export const verifyRefreshToken = (token) =>
  JWT.verify(token, process.env.JWT_REFRESH_SECRET);

const signMfaToken = (userId) =>
  JWT.sign({ id: userId, mfa_pending: true }, process.env.JWT_MFA_SECRET, {
    expiresIn: '5m',
  });

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Cookies   ────────────────────────────────────────────────────
const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: ms(process.env.JWT_COOKIE_ACCESS_EXPIRES_IN),
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: ms(process.env.JWT_COOKIE_REFRESH_EXPIRES_IN),
    path: '/v1/auth',
  });
};

const clearAuthCookies = (res) => {
  const opts = { httpOnly: true, secure: IS_PROD, sameSite: 'strict' };
  res.clearCookie('access_token', opts);
  res.clearCookie('refresh_token', { ...opts, path: '/v1/auth' });
};

// issue Tokens And Session  ---------------------------------------------------------------------------
const issueTokensAndSession = async (
  user,
  res,
  deviceInfo = {},
  oldSessionId = null
) => {
  const accessToken = signAccessToken({ id: user._id, roles: user.roles });
  const refreshToken = signRefreshToken({ id: user._id });

  if (oldSessionId) {
    await Session.findByIdAndUpdate(oldSessionId, {
      isActive: false,
      revokedAt: new Date(),
      revokedBy: 'rotation',
    });
  }

  const session = await Session.create({
    user: user._id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + ms(process.env.JWT_REFRESH_EXPIRES_IN)),
    deviceInfo,
    lastUsedAt: new Date(),
    mfaVerified: !user.mfaEnabled,
  });

  setAuthCookies(res, accessToken, refreshToken);

  return { accessToken, refreshToken, session };
};

// log in ────────────────────────────────────────────────────────────-------------------
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return next(new AppError('Please provide email and password.', 422));

  const user = await User.findOne({ email }).select('+password');
  if (!user) return next(new AppError('Incorrect email or password.', 401));

  if (user.isLocked()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return next(
      new AppError(`Account locked. Try again in ${mins} minute(s).`, 429)
    );
  }

  if (!(await user.correctPassword(password, user.password))) {
    await user.incrementLoginAttempts();
    const left = 5 - user.failedLoginAttempts;
    return next(
      new AppError(
        left > 0
          ? `Incorrect password. ${left} attempt(s) left.`
          : 'Account is now locked for 15 minutes.',
        401
      )
    );
  }

  if (!user.is_active)
    return next(new AppError('Your account is inactive.', 403));

  await user.resetLoginAttempts();

  if (user.mfaEnabled) {
    const mfaToken = signMfaToken(user._id);
    return res.status(200).json({
      ok: true,
      data: {
        mfa_required: true,
        methods: ['totp'],
        mfa_token: mfaToken,
        mfa_token_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
  }

  const { accessToken, refreshToken, session } = await issueTokensAndSession(
    user,
    res,
    req.deviceInfo
  );

  return res.status(200).json({
    ok: true,
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      session_jti: session._id,
      session_id: session._id,
      ip: req.deviceInfo?.ip,
      email: user.email,
      role: user.roles[0],
      mfa: {
        verified: false,
        methods: [],
      },
    },
  });
});

// REFRESH ACCESS TOKEN ──────────────────────────────────────────────
export const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const rt = req.cookies?.refresh_token || req.body?.refresh_token;
  if (!rt) return next(new AppError('No refresh token provided.', 401));

  let decoded;
  try {
    decoded = verifyRefreshToken(rt);
  } catch {
    return next(new AppError('Invalid or expired refresh token.', 401));
  }

  const session = await Session.findOne({
    refreshTokenHash: hashToken(rt),
    isActive: true,
  });

  if (!session) {
    await Session.updateMany(
      { user: decoded.id, isActive: true },
      { isActive: false, revokedAt: new Date(), revokedBy: 'system' }
    );
    return next(
      new AppError('Token reuse detected. All sessions revoked.', 401)
    );
  }

  const user = await User.findById(decoded.id);
  if (!user) return next(new AppError('User no longer exists.', 401));
  if (user.changedPasswordAfter(decoded.iat))
    return next(new AppError('Password changed. Please log in again.', 401));

  const {
    accessToken,
    refreshToken,
    session: newSession,
  } = await issueTokensAndSession(user, res, session.deviceInfo, session._id);

  return res.status(200).json({
    ok: true,
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      session_jti: newSession._id,
      session_id: newSession._id,
      ip: session.deviceInfo?.ip,
      email: user.email,
      role: user.roles[0],
      mfa: {
        verified: user.mfaEnabled,
        methods: user.mfaEnabled ? ['totp'] : [],
      },
    },
  });
});
// MFA  -----------------------------------------------------------------------
export const setupMFA = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+mfaSecret');
  if (user.mfaEnabled)
    return next(new AppError('MFA is already enabled.', 409));

  const { issuer = 'MAYA', label } = req.body;

  const secret = speakeasy.generateSecret({
    name: `${issuer} (${label || user.email})`,
    length: 20,
  });

  user.mfaSecret = secret.base32;
  await user.save({ validateBeforeSave: false });

  const qrDataUri = await qrcode.toDataURL(secret.otpauth_url);
  const qrPngBase64 = qrDataUri.split(',')[1]; // Base64 بدون الـ prefix

  return res.status(200).json({
    ok: true,
    data: {
      type: 'totp',
      issuer,
      label: label || user.email,
      secret_base32: secret.base32,
      otpauth_uri: secret.otpauth_url,
      qrcode_png_base64: qrPngBase64,
      qrcode_data_uri: qrDataUri,
    },
  });
});

export const verifyAndEnableMFA = asyncHandler(async (req, res, next) => {
  const { code, context = 'setup', mfa_token } = req.body;

  if (context === 'setup') {
    const user = await User.findById(req.user._id).select('+mfaSecret');
    if (!user.mfaSecret)
      return next(new AppError('Call /mfa/setup first.', 404));

    const ok = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!ok) return next(new AppError('Invalid TOTP code.', 401));

    user.mfaEnabled = true;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      ok: true,
      data: {
        enabled: true,
        verified_at: new Date(),
      },
    });
  }

  if (context === 'login') {
    if (!mfa_token)
      return next(
        new AppError('mfa_token is required for login context.', 422)
      );

    let decoded;
    try {
      decoded = JWT.verify(mfa_token, process.env.JWT_MFA_SECRET);
    } catch {
      return next(new AppError('Invalid or expired MFA token.', 401));
    }

    const user = await User.findById(decoded.id).select('+mfaSecret');
    if (!user || !user.mfaEnabled)
      return next(new AppError('MFA not enabled for this user.', 404));

    const ok = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!ok) return next(new AppError('Invalid TOTP code.', 401));

    const { accessToken, refreshToken, session } = await issueTokensAndSession(
      user,
      res,
      {}
    );

    return res.status(200).json({
      ok: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        session_jti: session._id,
        session_id: session._id,
        ip: req.ip || null,
        email: user.email,
        role: user.roles[0],
        mfa: {
          verified: true,
          methods: ['totp'],
          mfa_verified_at: new Date(),
        },
      },
    });
  }

  return next(new AppError('Invalid context. Use "setup" or "login".', 422));
});

export const completeMFALogin = (req, res, next) => {
  req.body.context = 'login';
  return verifyAndEnableMFA(req, res, next);
};

export const disableMFA = asyncHandler(async (req, res, next) => {
  const { password, code, mfa_token, user_id, reason } = req.body;
  const requester = req.user;

  if (user_id) {
    const isAdmin = requester.roles.some((r) =>
      ['admin', 'god_admin'].includes(r)
    );
    if (!isAdmin)
      return next(new AppError('Access denied. Admin role required.', 403));
    if (!reason)
      return next(new AppError('reason is required for admin disable.', 422));

    const target = await User.findById(user_id);
    if (!target || !target.mfaEnabled)
      return next(new AppError('MFA not enabled for this user.', 404));

    target.mfaEnabled = false;
    target.mfaSecret = undefined;
    target.mfaBackupCodes = [];
    await target.save({ validateBeforeSave: false });

    return res.status(200).json({ ok: true, data: { disabled: true } });
  }

  if (!password) return next(new AppError('password is required.', 422));
  if (!code && !mfa_token)
    return next(new AppError('Provide either code or mfa_token.', 422));

  const user = await User.findById(requester._id).select(
    '+password +mfaSecret'
  );

  if (!(await user.correctPassword(password, user.password)))
    return next(new AppError('Incorrect password.', 401));

  if (!user.mfaEnabled) return next(new AppError('MFA not enabled.', 404));

  if (code) {
    const ok = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!ok) return next(new AppError('Invalid TOTP code.', 401));
  }

  user.mfaEnabled = false;
  user.mfaSecret = undefined;
  user.mfaBackupCodes = [];
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({ ok: true, data: { disabled: true } });
});

// get Active Sessions  ───────────────────────────────────────────────
export const getActiveSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({
    user: req.user._id,
    isActive: true,
    expiresAt: { $gt: Date.now() },
  }).select('-refreshTokenHash');

  return res.status(200).json({
    ok: true,
    data: sessions,
  });
});

// revoke Session ────────────────────────────────────────────────────
export const revokeSession = asyncHandler(async (req, res, next) => {
  const session = await Session.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!session) return next(new AppError('Session not found.', 404));

  await session.revoke('user');

  return res.status(200).json({
    ok: true,
    data: {
      id: session._id,
      revoked_at: session.revokedAt,
    },
  });
});

// ── log out ────────────────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  const rt = req.cookies?.refresh_token || req.body?.refresh_token;

  if (rt) {
    await Session.findOneAndUpdate(
      { refreshTokenHash: hashToken(rt), isActive: true },
      { isActive: false, revokedAt: new Date(), revokedBy: 'user' }
    );
  }

  clearAuthCookies(res);
  return res.status(200).json({ ok: true });
});

// logout All  ────────────────────────────────────────────────────────
export const logoutAll = asyncHandler(async (req, res) => {
  await Session.updateMany(
    { user: req.user._id, isActive: true },
    { isActive: false, revokedAt: new Date(), revokedBy: 'user' }
  );
  clearAuthCookies(res);
  return res.status(200).json({ ok: true });
});
