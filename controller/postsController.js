import asyncHandler from 'express-async-handler';
import fs from 'fs';
import path from 'path';

import Media from '../models/modelMedia.js';
import Post from '../models/modelPosts.js';
import Tag from '../models/modelTag.js';
import AppError from '../utils/appError.js';

export const getAllPosts = asyncHandler(async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
  const skip = (page - 1) * limit;
  const { status, category, search } = req.query;

  const userRoles = req.user?.roles || [];
  const isAdmin = userRoles.some((r) => ['admin', 'super_admin'].includes(r));

  const filter = {};

  if (isAdmin) {
    if (status && ['draft', 'published', 'archived'].includes(status)) {
      filter.status = status;
    }
  } else {
    filter.status = 'published';
  }

  if (category) {
    filter.category_id = category;
  }

  if (search) {
    filter.$or = [
      { title_fa: { $regex: search, $options: 'i' } },
      { title_en: { $regex: search, $options: 'i' } },
      { title_ar: { $regex: search, $options: 'i' } },
    ];
  }

  const posts = await Post.find(filter)
    .populate('category_id', 'name_fa name_en name_ar')
    .populate('author_id', 'name email')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Post.countDocuments(filter);

  const items = posts.map((post) => ({
    id: post._id,
    author_id: post.author_id?._id || null,
    author_name: post.author_id?.name || null,
    category_id: post.category_id?._id || null,
    slug: post.slug,
    title_fa: post.title_fa,
    title_en: post.title_en,
    title_ar: post.title_ar,
    status: post.status,
    view_count: post.view_count,
    created_at: post.created_at,
    updated_at: post.updated_at,
    category_name_fa: post.category_id?.name_fa || null,
    category_name_en: post.category_id?.name_en || null,
    category_name_ar: post.category_id?.name_ar || null,
  }));

  return res.status(200).json({
    ok: true,
    items,
    meta: {
      limit,
      page,
      total,
      status: filter.status || 'published',
    },
  });
});
//  Get One ID ────────────────────────────────────────────────----------------------
export const getOnePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate('category_id', 'name_fa name_en name_ar')
    .populate('tags', 'slug name_fa name_en name_ar created_at');

  if (!post) return next(new AppError('Post not found.', 404));

  // ── Format tags ───────────────────────────────────────────────
  const tags = post.tags.map((tag) => ({
    id: tag._id,
    slug: tag.slug,
    name_fa: tag.name_fa,
    name_en: tag.name_en,
    name_ar: tag.name_ar,
    created_at: tag.created_at,
  }));

  return res.status(200).json({
    ok: true,
    item: {
      id: post._id,
      author_id: post.author_id,
      category_id: post.category_id?._id || null,
      slug: post.slug,
      title_fa: post.title_fa,
      title_en: post.title_en,
      title_ar: post.title_ar,
      content_fa: post.content_fa,
      content_en: post.content_en,
      content_ar: post.content_ar,
      status: post.status,
      view_count: post.view_count,
      custom_meta: post.custom_meta,
      created_at: post.created_at,
      updated_at: post.updated_at,
      category_name_fa: post.category_id?.name_fa || null,
      category_name_en: post.category_id?.name_en || null,
      category_name_ar: post.category_id?.name_ar || null,
      tags,
    },
    activities: [],
  });
});

//  Get One Slug ──────────────────────────────────────────────
export const getPostBySlug = asyncHandler(async (req, res, next) => {
  const post = await Post.findOne({ slug: req.params.slug })
    .populate('category_id', 'name_fa name_en name_ar')
    .populate('tags', 'slug name_fa name_en name_ar created_at');

  if (!post) return next(new AppError('Post not found.', 404));

  const tags = post.tags.map((tag) => ({
    id: tag._id,
    slug: tag.slug,
    name_fa: tag.name_fa,
    name_en: tag.name_en,
    name_ar: tag.name_ar,
    created_at: tag.created_at,
  }));

  return res.status(200).json({
    ok: true,
    item: {
      id: post._id,
      author_id: post.author_id,
      category_id: post.category_id?._id || null,
      slug: post.slug,
      title_fa: post.title_fa,
      title_en: post.title_en,
      title_ar: post.title_ar,
      content_fa: post.content_fa,
      content_en: post.content_en,
      content_ar: post.content_ar,
      status: post.status,
      view_count: post.view_count,
      custom_meta: post.custom_meta,
      created_at: post.created_at,
      updated_at: post.updated_at,
      category_name_fa: post.category_id?.name_fa || null,
      category_name_en: post.category_id?.name_en || null,
      category_name_ar: post.category_id?.name_ar || null,
      tags,
    },
    activities: [],
  });
});

//  Create Post ───────────────────────────────────────────────────────
export const createPost = asyncHandler(async (req, res, next) => {
  const {
    slug,
    title_fa,
    title_en,
    title_ar,
    content_fa,
    content_en,
    content_ar,
    status,
    category_id,
    custom_meta,
    media_uuids = [],
  } = req.body;

  if (!title_fa && !title_en && !title_ar)
    return next(new AppError('At least one title is required.', 422));

  if (!slug) return next(new AppError('slug is required.', 422));

  let post;
  try {
    post = await Post.create({
      slug,
      title_fa,
      title_en,
      title_ar,
      content_fa,
      content_en,
      content_ar,
      status: status || 'draft',
      category_id: category_id || null,
      custom_meta: custom_meta || null,
      author_id: req.user._id,
    });
  } catch (err) {
    if (err.code === 11000)
      return next(new AppError('Slug already exists.', 409));
    return next(err);
  }

  let linkedCount = 0;
  if (Array.isArray(media_uuids) && media_uuids.length > 0) {
    const validMedia = await Media.find({
      uuid: { $in: media_uuids },
      status: 'pending',
    });

    if (validMedia.length > 0) {
      await Media.updateMany(
        { _id: { $in: validMedia.map((m) => m._id) } },
        { entity_id: post._id, entity_type: 'post', status: 'linked' }
      );
      linkedCount = validMedia.length;
    }
  }

  return res.status(200).json({
    ok: true,
    id: post._id,
    linked_media: linkedCount,
  });
});

//  Update Post ───────────────────────────────────────────────────────
export const updatePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found.', 404));

  const {
    slug,
    title_fa,
    title_en,
    title_ar,
    content_fa,
    content_en,
    content_ar,
    status,
    category_id,
    custom_meta,
    media_uuids = [],
  } = req.body;

  const updates = {};
  const allowed = [
    'slug',
    'title_fa',
    'title_en',
    'title_ar',
    'content_fa',
    'content_en',
    'content_ar',
    'status',
    'category_id',
  ];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (custom_meta !== undefined) {
    if (custom_meta === null) {
      updates.custom_meta = null;
    } else {
      updates.custom_meta = {
        ...(post.custom_meta || {}),
        ...custom_meta,
      };
    }
  }

  if (Object.keys(updates).length === 0)
    return next(new AppError('No valid fields provided to update.', 422));

  try {
    await Post.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
  } catch (err) {
    if (err.code === 11000)
      return next(new AppError('Slug already exists.', 409));
    return next(err);
  }

  let linkedCount = 0;
  if (Array.isArray(media_uuids) && media_uuids.length > 0) {
    const validMedia = await Media.find({
      uuid: { $in: media_uuids },
      status: 'pending',
    });

    if (validMedia.length > 0) {
      await Media.updateMany(
        { _id: { $in: validMedia.map((m) => m._id) } },
        { entity_id: post._id, entity_type: 'post', status: 'linked' }
      );
      linkedCount = validMedia.length;
    }
  }

  return res.status(200).json({
    ok: true,
    updated: true,
    linked_media: linkedCount,
  });
});

// add Tag ----------------------------------------------------
export const addTag = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found.', 404));

  const isAllowed = req.user.roles.some((r) =>
    ['super_admin', 'admin', 'writer'].includes(r)
  );
  if (!isAllowed)
    return res.status(403).json({ ok: false, error: 'Forbidden.' });

  let tag;
  if (req.body.tag_id) {
    tag = await Tag.findById(req.body.tag_id);
  } else if (req.body.name_ar || req.body.name_fa || req.body.name_en) {
    tag = await Tag.findOne({
      $or: [
        { name_ar: req.body.name_ar },
        { name_fa: req.body.name_fa },
        { name_en: req.body.name_en },
      ],
    });
  }
  if (!tag) return next(new AppError('Tag not found.', 404));

  const isTagAdded = post.tags.some((t) => t.toString() === tag._id.toString());

  if (isTagAdded) {
    return next(new AppError('Tag already added.', 409));
  }

  post.tags.push(tag._id);
  await post.save();

  const tags = post.tags.map((tag) => ({
    id: tag._id,
    slug: tag.slug,
    name_fa: tag.name_fa,
    name_en: tag.name_en,
    name_ar: tag.name_ar,
    created_at: tag.created_at,
  }));
  return res.status(200).json({
    ok: true,
    data: {
      post_id: post._id,
      tags,
    },
  });
});

//  Delete Post ──────────────────────────────────
export const deletePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found.', 404));

  const hardDelete =
    req.query.hard_delete === 'true' || req.body.hard_delete === true;

  if (hardDelete) {
    const isSuperAdmin = req.user.roles.includes('super_admin');
    if (!isSuperAdmin)
      return res.status(403).json({ ok: false, error: 'Forbidden.' });

    const mediaList = await Media.find({
      entity_id: post._id,
      entity_type: 'post',
    });

    let filesDeleted = 0;
    const fs = await import('fs');
    const path = await import('path');

    for (const media of mediaList) {
      const filePath = path.join('uploads', media.entity_type, media.file_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        filesDeleted++;
      }
    }

    const { deletedCount } = await Media.deleteMany({
      entity_id: post._id,
      entity_type: 'post',
    });

    await Post.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      ok: true,
      deleted: true,
      hard_delete: true,
      media_purge: {
        files_deleted: filesDeleted,
        records_deleted: deletedCount,
      },
    });
  }

  // ── Soft Delete ────────────────────────────────────────────────
  post.status = 'archived';
  await post.save();

  return res.status(200).json({
    ok: true,
    deleted: true,
  });
});

//  delete   Tag from a Post ---------------------------------------
export const deleteTag = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.idP).populate('tags');
  if (!post) return next(new AppError('Post not found.', 404));

  const tag = await Tag.findById(req.params.idT);
  if (!tag) return next(new AppError('Tag not found.', 404));

  const isAllowed = req.user.roles.some((r) =>
    ['super_admin', 'admin', 'writer'].includes(r)
  );
  if (!isAllowed)
    return res.status(403).json({ ok: false, error: 'Forbidden.' });

  const isTagAdded = post.tags.some(
    (t) => t._id.toString() === tag._id.toString()
  );
  if (!isTagAdded) return next(new AppError('Tag not added.', 404));

  post.tags = post.tags.filter((t) => t._id.toString() !== tag._id.toString());
  await post.save();


  const tags = post.tags.map((t) => ({
    id: t._id,
    slug: t.slug,
    name_fa: t.name_fa,
    name_en: t.name_en,
    name_ar: t.name_ar,
    created_at: t.created_at,
  }));

  return res.status(200).json({
    ok: true,
    data: {
      post_id: post._id,
      tags,
    },
  });
});
