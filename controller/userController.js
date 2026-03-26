import asyncHandler from 'express-async-handler';
import speakeasy from 'speakeasy';

import User from '../models/modelUser.js';
import AppError from '../utils/appError.js';

// Create   (admin)------------------------------------------------------
export const createUser = asyncHandler(async (req, res, next) => {
  const {
    email,
    password,
    display_name,
    first_name,
    last_name,
    locale,
    avatar_url,
    timezone,
    phone,
    is_active,
    roles,
  } = req.body;

  if (!email || !password)
    return next(new AppError('Email and password are required.', 422));

  const requesterRoles = req.user.roles;
  const isSuperAdmin = requesterRoles.includes('super_admin');
  const protectedRoles = ['admin', 'super_admin'];

  if (!isSuperAdmin && roles?.some((r) => protectedRoles.includes(r)))
    return next(
      new AppError('You cannot assign admin or super_admin roles.', 403)
    );

  const user = await User.create({
    email,
    password,
    display_name,
    first_name,
    last_name,
    locale,
    avatar_url,
    timezone,
    phone,
    is_active: is_active ?? true,
    roles: roles || ['user'],
  });

  return res.status(201).json({
    ok: true,
    id: user._id,
  });
});
// Get All    (admin)  -------------------------------
export const getAllUsers = asyncHandler(async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const per_page = Math.min(
    Math.max(parseInt(req.query.per_page) || 25, 1),
    100
  );
  const skip = (page - 1) * per_page;
  const search = req.query.search;
  const is_active = req.query.is_active;
  const sort = req.query.sort;

  const filter = {};

  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { display_name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  if (is_active !== undefined) {
    filter.is_active = is_active === 'true';
  }

  let sortObj = { created_at: -1 };
  if (sort) {
    const isDesc = sort.startsWith('-');
    const field = isDesc ? sort.slice(1) : sort;

    const allowed = ['created_at', 'email', 'last_activity'];
    if (!allowed.includes(field))
      return next(new AppError('Invalid sort field.', 422));

    sortObj = { [field]: isDesc ? -1 : 1 };
  }

  const [items, total_items] = await Promise.all([
    User.find(filter)
      .select('email display_name is_active roles updated_at')
      .sort(sortObj)
      .skip(skip)
      .limit(per_page),
    User.countDocuments(filter),
  ]);

  const total_pages = Math.ceil(total_items / per_page);

  return res.status(200).json({
    ok: true,
    data: {
      items: items.map((u) => ({
        id: u._id,
        email: u.email,
        display_name: u.display_name,
        is_active: u.is_active,
        roles: u.roles,
        last_activity: u.updated_at,
      })),
      meta: {
        page,
        per_page,
        total_items,
        total_pages,
      },
    },
  });
});

// Get  (admin) ────────────────────────────────────────────
export const getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user)
    return next(new AppError('User not found.', 404));

  return res.status(200).json({
    ok: true,
    data: {
      id:           user._id,
      email:        user.email,
      display_name: user.display_name,
      locale:       user.locale,
      timezone:     user.timezone,
      phone:        user.phone,
      is_active:    user.is_active,
      roles:        user.roles,
      created_at:   user.created_at,
      updated_at:   user.updated_at,
    },
  });
});

// Update  (admin) ───────────────────────────────────────────────---------------------
export const updateUser = asyncHandler(async (req, res, next) => {
  const target = await User.findById(req.params.id);

  if (!target)
    return next(new AppError('User not found.', 404));

  const isSuperAdmin = req.user.roles.includes('super_admin');
  const targetIsProtected = target.roles.some((r) =>
    ['admin', 'super_admin'].includes(r)
  );

  if (!isSuperAdmin && targetIsProtected)
    return next(new AppError('You cannot manage admin or super_admin users.', 403));

  const protectedRoles = ['admin', 'super_admin'];
  if (!isSuperAdmin && req.body.roles?.some((r) => protectedRoles.includes(r)))
    return next(new AppError('You cannot assign admin or super_admin roles.', 403));

  const allowed = [
    'display_name', 'first_name', 'last_name',
    'locale', 'avatar_url', 'timezone',
    'phone', 'email', 'is_active', 'roles',
  ];

  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0)
    return next(new AppError('No valid fields provided to update.', 422));

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      ok: true,
      updated: true,
      data: {
        id:           user._id,
        email:        user.email,
        display_name: user.display_name,
        locale:       user.locale,
        timezone:     user.timezone,
        phone:        user.phone,
        is_active:    user.is_active,
        roles:        user.roles,
        updated_at:   user.updated_at,
      },
    });
  } catch (err) {
    if (err.code === 11000)
      return next(new AppError('Email already exists.', 409));
    next(err);
  }
});

// Delete  (admin) -----------------------------------------------------------------------------------
export const deleteUser = asyncHandler(async (req, res, next) => {
  const target = await User.findById(req.params.id);

  if (!target) return next(new AppError('User not found.', 404));

  if (target._id.equals(req.user._id))
    return next(new AppError('You cannot delete your own account.', 403));

  const isSuperAdmin = req.user.roles.includes('super_admin');
  const targetIsProtected = target.roles.some((r) =>
    ['admin', 'super_admin'].includes(r)
  );

  if (!isSuperAdmin && targetIsProtected)
    return next(
      new AppError('You cannot delete admin or super_admin users.', 403)
    );

  if (target.roles.includes('super_admin')) {
    const count = await User.countDocuments({
      roles: 'super_admin',
      is_active: true,
    });
    if (count <= 1)
      return next(new AppError('Cannot delete the last super_admin.', 403));
  }

  target.is_active = false;
  await target.save({ validateBeforeSave: false });

  return res.status(200).json({
    ok: true,
    data: { id: target._id, deleted: true },
  });
});

// Get My Profile ------------------------------------------------------
export const getMyProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  return res.status(200).json({
    ok: true,
    data: {
      id: user._id,
      email: user.email,
      display_name: user.display_name,
      locale: user.locale,
      avatar_url: user.avatar_url,
      timezone: user.timezone,
      phone: user.phone,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  });
});

// Update My Profile ------------------------------------------------------------------------------
export const updateMyProfile = asyncHandler(async (req, res, next) => {
  const allowed = ['display_name', 'locale', 'avatar_url', 'timezone', 'phone'];

  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (Object.keys(updates).length === 0)
    return next(new AppError('No valid fields provided to update.', 422));

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) return next(new AppError('User not found.', 404));

  return res.status(200).json({
    ok: true,
    data: {
      id: user._id,
      email: user.email,
      display_name: user.display_name,
      locale: user.locale,
      avatar_url: user.avatar_url,
      timezone: user.timezone,
      phone: user.phone,
      is_active: user.is_active,
      updated_at: user.updated_at,
    },
  });
});

//Update My Password ────────────────────────────────────────────────
export const updateMyPassword = asyncHandler(async (req, res, next) => {
  const { current_password, new_password, new_password_confirmation } = req.body;

  if (!current_password || !new_password)
    return next(new AppError('current_password and new_password are required.', 422));

  if (new_password_confirmation && new_password !== new_password_confirmation)
    return next(new AppError('Passwords do not match.', 422));

  const strongPassword = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
  if (!strongPassword.test(new_password))
    return next(new AppError('Password must be at least 8 characters and include letters and numbers.', 422));

  const user = await User.findById(req.user._id).select('+password +mfaSecret');
  if (!user) return next(new AppError('User not found.', 404));

  if (user.mfaEnabled) {
    const mfaCode = req.headers['x-mfa-code'];
    if (!mfaCode)
      return next(new AppError('MFA code is required.', 401));

    const valid = speakeasy.totp.verify({
      secret:   user.mfaSecret,
      encoding: 'base32',
      token:    mfaCode,
      window:   1,
    });
    if (!valid)
      return next(new AppError('Invalid MFA code.', 401));
  }

  if (!(await user.correctPassword(current_password, user.password)))
    return next(new AppError('Current password is incorrect.', 401));

  user.password = new_password;
  await user.save();

  return res.status(200).json({
    ok: true,
    data: {
      password_changed:    true,
      password_changed_at: user.passwordChangedAt,
    },
  });
});

