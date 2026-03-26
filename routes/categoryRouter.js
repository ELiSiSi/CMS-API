import express from "express";

import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  createCategory,
  getAllCategories,
    updateCategory,
    deleteCategory
} from "../controller/categoryController.js";

const router = express.Router();

router.use(protect);
router.use(restrictTo("admin", "super_admin", "writer"));

router.post("/", createCategory);
router.get("/", getAllCategories);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
