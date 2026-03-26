import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    refreshTokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    deviceInfo: {
      userAgent: String,
      ip: String,
      device: String,
      os: String,
      browser: String,
    },
    isActive: { type: Boolean, default: true, index: true },
    revokedAt: Date,
    revokedBy: { type: String, enum: ['user', 'admin', 'system', 'rotation'] },
    lastUsedAt: { type: Date, default: Date.now },
    mfaVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// revoke session ------------------------------------------------------------------------------
sessionSchema.methods.revoke = function (reason = 'user') {
  this.isActive = false;
  this.revokedAt = new Date();
  this.revokedBy = reason;
  return this.save();
};

// Indexes ------------------------------------------------------------------------------
sessionSchema.index({ user: 1 });
export default mongoose.model('Session', sessionSchema);
