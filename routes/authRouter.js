import express from 'express';

import {
  login,
  logout,
  refreshAccessToken,
  setupMFA,
  verifyAndEnableMFA,
  disableMFA,
  completeMFALogin,
} from '../controller/authController.js';

import {
  loginRateLimit,
  parseDeviceInfo,
  protect,
} from '../middleware/authMiddleware.js';

const router = express.Router();

//─ Device Info ─────────────────────────────────────────────────────────------
router.use(parseDeviceInfo);

// ── Public Routes ────────────────────────────────────────────────────
router.post('/login', loginRateLimit, login);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);
router.post('/mfa/verify', completeMFALogin);

//Protected Routes ─────────────────────────────────────────────────
router.use(protect);

//  MFA  -────────────────────────────────────────────────────────────
router.post('/mfa/setup', setupMFA);
router.post('/mfa/enable', verifyAndEnableMFA);
router.post('/mfa/disable', disableMFA);


export default router;
