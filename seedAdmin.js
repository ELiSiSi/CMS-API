import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();


// ── God Admin Data ────────────────────────────────────────────────────
const adminData = {
  display_name: 'Super Admin',
  first_name: 'Super',
  last_name: 'Admin',
  email:`${process.env.MY_EMAIL_ADMIN}`,
  password: await bcrypt.hash(process.env.MY_EMAIL_ADMIN_PASSWORD, 12),
  roles: ['super_admin'],
  is_active: true,
  locale: 'en',
  timezone: 'UTC',
  isEmailVerified: true,
  failedLoginAttempts: 0,
  mfaEnabled: false,
  created_at: new Date(),
  updated_at: new Date(),
};

// ── Run Seed ──────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log(' Connected to MongoDB');

    const existing = await mongoose.connection
      .collection('users')
      .findOne({ email: adminData.email });

    if (existing) {
      console.log('  super Admin already exists:', adminData.email);
    } else {
      await mongoose.connection.collection('users').insertOne(adminData);
      console.log(' super Admin created successfully!');
    }
  })
  .catch((err) => console.error(' MongoDB Error:', err))
  .finally(async () => {
    await mongoose.disconnect();
    console.log(' Disconnected from MongoDB');
    process.exit(0);
  });


