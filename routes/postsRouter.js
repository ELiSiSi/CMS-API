import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
  getAllPosts,
  getOnePost,
  getPostBySlug,
  createPost,
  updatePost,
  addTag,
  deletePost,
  deleteTag,
} from '../controller/postsController.js';

const router = express.Router({ mergeParams: true });

// ── Public Routes ─────────────────────────────────
router.get('/slug/:slug', getPostBySlug);
router.get('/:id', getOnePost);
router.get('/', getAllPosts);


// ── Protected  ──────────────────────────────────────────────────
router.use(protect);
router.use(restrictTo('admin', 'super_admin', 'writer'));

router.post('/', createPost);
router.put('/:id', updatePost);
router.post('/:id/tags', addTag);
router.delete('/:id', deletePost);
router.delete('/:idP/tags/:idT', deleteTag);




export default router;
