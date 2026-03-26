import asyncHandler from 'express-async-handler';

import Tag from '../models/modelTag.js';
import AppError from '../utils/appError.js';
import { filter } from 'compression';

//  Create  ─────────────────────----------------------------------------------------------
export const createTag = asyncHandler(async (req, res, next) => {
    const { name_en, name_fa, name_ar } = req.body;
    if (!name_en || !name_fa || !name_ar) {
        return next(new AppError('All name fields are required.', 422));
    }
    const tag = await Tag.create({
        name_en,
        name_fa,
        name_ar,
    });
    return res.status(201).json({
        ok: true,
        data: {
            id: tag._id,
            name_en: tag.name_en,
            name_fa: tag.name_fa,
            name_ar: tag.name_ar,
            slug: tag.slug,
        },
    });
});

//  Get All ────────--------------------
export const getAllTags = asyncHandler(async (req, res, next) => {
const page =Math.max( parseInt(req.query.page) || 1, 1);
const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 100);
    const skip = (page - 1) * limit;
    const search = req.query.q ;
    filter = {};
    if (search) {
        filter.$or = [
            { name_en: { $regex: search, $options: 'i' } },
            { name_fa: { $regex: search, $options: 'i' } },
            { name_ar: { $regex: search, $options: 'i' } },
        ];
    }
    const tags = await Tag.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const items =tags.map((tag) => ({
        id: tag._id,
        name_en: tag.name_en,
        name_fa: tag.name_fa,
        name_ar: tag.name_ar,
        slug: tag.slug,
    }));
  return res.status(200).json({
    ok: true,
      items,
    meta: {
        page,
        limit,
        q: search
    }
  });
});

// update  ─────────────────────────────────────────────────────
export const updateTag = asyncHandler(async (req, res, next) => {
  const tag = await Tag.findById(req.params.id);
  if (!tag) return next(new AppError('Tag not found.', 404));

  const updates = {};

  ['name_en', 'name_fa', 'name_ar'].forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (Object.keys(updates).length === 0)
    return next(new AppError('No valid fields provided.', 422));

  const updatedTag = await Tag.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );


  return res.status(200).json({
    ok: true,
    data: {
      id: updatedTag._id,
      name_en: updatedTag.name_en,
      name_fa: updatedTag.name_fa,
      name_ar: updatedTag.name_ar,
      slug: updatedTag.slug,
      created_at: updatedTag.created_at,
    },
  });
});

//  Delete Tag ───────────────────────────────────────────────────────
export const deleteTag = asyncHandler(async (req, res, next) => {
    const tag = await Tag.findById(req.params.id);
    if (!tag) return next(new AppError('Tag not found.', 404));
    const deleted = await Tag.findByIdAndDelete(req.params.id);
    return res.status(200).json({
        ok: true,
        data: {
            deleted: true,
            id: deleted._id

        }
    });
});

