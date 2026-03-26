import express from "express";

import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
    createTag,
    getAllTags,
    updateTag,
    deleteTag,
} from "../controller/tagController.js";

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get("/", getAllTags);
router.use(restrictTo("admin", "super_admin", "writer"));
router.post("/", createTag);
router.put("/:id", updateTag);
router.delete("/:id", deleteTag);

export default router;
