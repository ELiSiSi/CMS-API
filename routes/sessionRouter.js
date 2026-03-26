import express from "express";
 import {
  getMySessions,
  getAllSessions,
  revokeSession,
  revokeAllSessions,
} from '../controller/sessionController.js';
import { protect , restrictTo } from "../middleware/authMiddleware.js";
const router = express.Router();

router.use(protect);

router.get("/me", getMySessions);

router.get('/all', restrictTo('admin', 'super_admin'), getAllSessions);

router.post('/revoke', revokeAllSessions);


router.post('/:id/revoke', restrictTo('admin', 'super_admin'), revokeSession);

export default router;
