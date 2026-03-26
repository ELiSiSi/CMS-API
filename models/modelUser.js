import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    display_name: { type: String, trim: true, maxlength: 80, default: null },
    first_name: { type: String, trim: true, maxlength: 80, default: null },
    last_name: { type: String, trim: true, maxlength: 80, default: null },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },

    locale: { type: String, enum: ['fa', 'en', 'ar'], default: 'en' },
    avatar_url: { type: String, default: null },
    timezone: { type: String, default: 'UTC' },
    phone: { type: String, maxlength: 32, default: null },

    is_active: { type: Boolean, default: true },

    roles: {
      type: [String],
      enum: [
        'user',
        'admin',
        'super_admin',
        'writer',
        'editor',
      ],
      default: ['user'],
    },

    passwordChangedAt: Date,

    // OTP / Forgot Password ──────────────────────────────────------------------------------
    passwordResetOTP: { type: String, select: false },
    passwordResetOTPExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetTokenExpires: { type: Date, select: false },

    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    // MFA ────────────────────────────────────────────────────--
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false, default: null },
    mfaBackupCodes: { type: [String], select: false, default: [] },
    mfaPendingToken: { type: String, select: false, default: null },

    isEmailVerified: { type: Boolean, default: false },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// ── Password Hashing ────────────────────────────────────────────────---
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

// ── Methods ─────────────────────────────────────────────────────────--------------------------------
userSchema.methods.correctPassword = async function (candidate, hashed) {
  return bcrypt.compare(candidate, hashed);
};

userSchema.methods.changedPasswordAfter = function (iat) {
  return this.passwordChangedAt
    ? Math.floor(this.passwordChangedAt.getTime() / 1000) > iat
    : false;
};

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.incrementLoginAttempts = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5)
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.resetLoginAttempts = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = undefined;
  await this.save({ validateBeforeSave: false });
};


//  Indexes ──────────────────────────────────────────────────────────
userSchema.index({ roles: 1 });
userSchema.index({ is_active: 1 });

export default mongoose.model('User', userSchema);
