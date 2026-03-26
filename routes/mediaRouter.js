import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { uploadSingleFile  } from '../middleware/uploadMiddleware.js';
import {
  uploadMedia,
  cleanupOrphanMedia,
} from '../controller/mediaController.js';

const router = express.Router();

router.use(protect);

router.post(
  '/upload',
  restrictTo('admin', 'super_admin', 'writer'),
  uploadSingleFile,
  uploadMedia
);

router.delete(
  '/cleanup-orphans',
  restrictTo('admin', 'super_admin'),
  cleanupOrphanMedia
);

export default router;
