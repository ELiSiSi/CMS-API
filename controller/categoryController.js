import asyncHandler from 'express-async-handler';

import Category from '../models/modelCategory.js';
import AppError from '../utils/appError.js';


//  Create  ─────────────────────
export const createCategory = asyncHandler(async (req, res, next) => {
    const { name_en, name_fa, name_ar, parent_id } = req.body;
    if (!name_en && !name_fa && !name_ar) {
        return next(new AppError(' name fields are required.', 422));
    }
    const category = await Category.create({
        name_en,
        name_fa,
        name_ar,
        parent_id,
    });
    return res.status(201).json({
        ok: true,
        data: {
            id: category._id,
            parent_id: category.parent_id,
            name_en: category.name_en,
            name_fa: category.name_fa,
            name_ar: category.name_ar,
            slug: category.slug,
        },
    });
    })

//  Get All ───────────────────────────────────────────────────────────────----------------------
export const getAllCategories = asyncHandler(async (req, res, next) => {
  const categories = await Category.find()
    .populate('parent_id', 'name_en name_ar name_fa')
    .sort({ createdAt: -1 });

  const data = categories.map((cat) => ({
    id: cat._id,
    parent_id: cat.parent_id?._id || null,
    parent_name_en: cat.parent_id?.name_en || null,
    parent_name_ar: cat.parent_id?.name_ar || null,
    parent_name_fa: cat.parent_id?.name_fa || null,
    name_en: cat.name_en,
    name_fa: cat.name_fa,
    name_ar: cat.name_ar,
    slug: cat.slug,
  }));

  return res.status(200).json({
    ok: true,
    data,
  });
});
// update  ─────────────────────────────────────────────────────
export const updateCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) return next(new AppError('Category not found.', 404));

  const updates = {};

  ['name_en', 'name_fa', 'name_ar', 'parent_id'].forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (Object.keys(updates).length === 0)
    return next(new AppError('No valid fields provided.', 422));

  const updatedCategory = await Category.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );

  return res.status(200).json({
    ok: true,
    updated: true,
  });
});

//  Delete  ─────────────────────────────────────────────────────
export const deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) return next(new AppError('Category not found.', 404));

  await Category.findByIdAndDelete(req.params.id);

  return res.status(200).json({
    ok: true,
    deleted: true,
  });
});
