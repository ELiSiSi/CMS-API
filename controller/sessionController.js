import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Session from '../models/modelSession.js';
import AppError from '../utils/appError.js';

//Get  ────────────────────────────────────────
export const getMySessions = asyncHandler(async (req, res, next) => {
  const { user_id } = req.query;

  const isAdmin = req.user.roles.some((r) =>
    ['admin', 'super_admin'].includes(r)
  );

  let targetUserId = req.user._id;

  if (user_id) {
    if (!isAdmin) return next(new AppError('Access denied.', 403));

    if (!mongoose.Types.ObjectId.isValid(user_id))
      return next(new AppError('Invalid user_id.', 422));

    targetUserId = user_id;
  }

  const sessions = await Session.find({
    user: targetUserId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  })
    .select('-refreshTokenHash -__v')
    .sort({ createdAt: -1 });

  const currentSessionId = req.currentSessionId;

  const data = sessions.map((session) => ({
    id: session._id,
    user_id: session.user,
    jti: session._id,
    ip: session.deviceInfo?.ip || null,
    user_agent: session.deviceInfo?.userAgent || null,
    created_at: session.createdAt,
    last_seen_at: session.lastUsedAt,
    revoked_at: session.revokedAt || null,
    current: currentSessionId
      ? session._id.toString() === currentSessionId.toString()
      : false,
  }));

  return res.status(200).json({
    ok: true,
    data,
  });
});

// get All   (admin)  -------------------------------------
export const getAllSessions = asyncHandler(async (req, res, next) => {
  const sessions = await Session.find()
    .populate('user', 'email display_name')
    .select('-refreshTokenHash -__v')
    .sort({ createdAt: -1 });

const data = sessions
  .filter((session) => session.user)
  .map((session) => ({
    id: session._id,
    user_id: session.user._id,
    user_email: session.user.email,
    user_display_name: session.user.display_name,
    jti: session._id,
    ip: session.deviceInfo?.ip || null,
    user_agent: session.deviceInfo?.userAgent || null,
    created_at: session.createdAt,
    last_seen_at: session.lastUsedAt,
    revoked_at: session.revokedAt || null,
  }));

  return res.status(200).json({
    ok: true,
    data,
  });
});

// Revoke  ─────────────────────────────────────────
export const revokeSession = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new AppError('Invalid session identifier.', 422));

  const session = await Session.findById(id);
  if (!session || !session.isActive)
    return next(new AppError('Session not found.', 404));

  const isOwner = session.user.equals(req.user._id);
  const isAdmin = req.user.roles.some((r) =>
    ['admin', 'super_admin'].includes(r)
  );
  const isSuperAdmin = req.user.roles.includes('super_admin');

  if (!isOwner && !isAdmin) return next(new AppError('Access denied.', 403));

  if (!isOwner && !isSuperAdmin) {
    const targetUser = await mongoose.model('User').findById(session.user);
    const targetIsProtected = targetUser?.roles.some((r) =>
      ['admin', 'super_admin'].includes(r)
    );
    if (targetIsProtected) return next(new AppError('Access denied.', 403));
  }

  session.isActive = false;
  session.revokedAt = new Date();
  session.revokedBy = 'user';
  await session.save();

  return res.status(200).json({
    ok: true,
    data: {
      id: session._id,
      revoked_at: session.revokedAt,
    },
  });
});

// Revoke ALL  ----------------------------------------------------
export const revokeAllSessions = asyncHandler(async (req, res, next) => {
  const { user_id } = req.body;

  const isAdmin = req.user.roles.some((r) =>
    ['admin', 'super_admin'].includes(r)
  );
  const isSuperAdmin = req.user.roles.includes('super_admin');

  let targetUserId = req.user._id;

  if (user_id) {
    if (!isAdmin) return next(new AppError('Access denied.', 403));

    if (!mongoose.Types.ObjectId.isValid(user_id))
      return next(new AppError('Invalid user_id.', 422));

    const targetUser = await mongoose.model('User').findById(user_id);
    if (!targetUser) return next(new AppError('User not found.', 404));

    const targetIsProtected = targetUser.roles.some((r) =>
      ['admin', 'super_admin'].includes(r)
    );
    if (!isSuperAdmin && targetIsProtected)
      return next(new AppError('Access denied.', 403));

    targetUserId = user_id;
  }

  const filter = {
    user: targetUserId,
    isActive: true,
  };

  if (
    req.currentSessionId &&
    targetUserId.toString() === req.user._id.toString()
  ) {
    filter._id = { $ne: req.currentSessionId };
  }

  const result = await Session.updateMany(filter, {
    isActive: false,
    revokedAt: new Date(),
    revokedBy: 'user',
  });

  return res.status(200).json({
    ok: true,
    data: {
      revoked_count: result.modifiedCount,
    },
  });
});
