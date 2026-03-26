import mongoose from 'mongoose';

const loginAttemptSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    blocked_until: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

export default mongoose.model('LoginAttempt', loginAttemptSchema);
