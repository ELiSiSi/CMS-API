import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AppError from '../utils/appError.js';

// Extensions  ───────────────────────────────────────────
const Extensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',

  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',

  'mp4',
  'mov',
  'mkv',
];

// MIME Types  ───────────────────────────────────────────-----------------
const mimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',

  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/flac',

  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
];

// maxSize ────────────────────────────────────────────────
const maxSize = 20 * 1024 * 1024;

//  Storage ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entity_type = req.body.entity_type || 'general';

    const validEntityType = /^[a-z0-9_]{2,64}$/.test(entity_type);
    if (!validEntityType) {
      return cb(new AppError('Invalid entity type.', 422) , false);
    }

    const uploadPath = path.join('uploads', entity_type);

    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);

    const uuid = uuidv4();
    req.fileUuid = uuid;

    cb(null, `${uuid}.${ext}`);
  },
});

// ── File Filter ───────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (!mimeTypes.includes(file.mimetype)) {
    return cb(new AppError('Invalid file type.', 422));
  }

  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (!Extensions.includes(ext)) {
    return cb(new AppError('Invalid file extension.', 422));
  }

  cb(null, true);
};

// ── Multer Instance ───────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxSize,
  },
});

// Middleware  single ─────────────────────────────────----------------------------------------
export const uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!req.file) {
      return next(new AppError('No file uploaded.', 422));
    }

    if (err?.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File too large. Maximum size is 20MB.', 422));
    }

    if (err) {
      return next(new AppError(err.message || 'Upload failed.', 422));
    }

    next();
  });
};

// ── Export الـ constants علشان الـ cont  roller يستخدمها ─────────────────
export { Extensions, mimeTypes, maxSize };
