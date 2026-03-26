import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
  deleteUser,
  getAllUsers,
  getMyProfile,
  updateMyProfile,
  getUser,
  updateUser,
  createUser,
  updateMyPassword,
} from '../controller/userController.js';

const router = express.Router();

router.use(protect);

// All user ─────────────────────────────────----------------------------------------
router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.patch('/me/password', updateMyPassword);


//admin only ────────────────────────────────────────
router.use(restrictTo('super_admin', 'admin'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.get('/:id', getUser);
router.put('/:id', updateUser);


router.delete('/:id',restrictTo('super_admin'), deleteUser);

export default router;


