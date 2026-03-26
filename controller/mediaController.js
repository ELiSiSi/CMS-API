import path from 'path';
import asyncHandler from 'express-async-handler';

import Media from '../models/modelMedia.js';
import AppError from '../utils/appError.js';



export const uploadMedia = asyncHandler(async (req, res, next) => {
  const file = req.file;
  const entity_type = req.body.entity_type || 'general';
  const uuid = req.fileUuid;
  if (!file) return next(new AppError('No file uploaded.', 422));

  // 2) استخرج الـ extension
  const ext = path.extname(file.originalname).toLowerCase().slice(1);

  const baseUrl =process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${baseUrl}/uploads/${entity_type}/${uuid}.${ext}`;

  const media = await Media.create({
    uuid,
    uploader_id: req.user._id,
    entity_type,
    entity_id: null,
    original_name: file.originalname,
    file_name: `${uuid}.${ext}`,
    url,
    mime_type: file.mimetype,
    extension: ext,
    size_bytes: file.size,
    status: 'pending',
  });

  return res.status(200).json({
    ok: true,
    uuid: media.uuid,
    url: media.url,
  });
});


//  Cleanup Orphan  ─────────────────────────────────────────────────────-----------──
export const cleanupOrphanMedia = asyncHandler(async (req, res, next) => {
  const isAdmin = req.user.roles.some((r) =>
    ['admin', 'god_admin'].includes(r)
  );
  if (!isAdmin) return next(new AppError('Access denied.', 403));

  let hours = parseInt(req.body.hours || req.query.hours || 24);
  if (isNaN(hours) || hours < 1 || hours > 720)
    return next(new AppError('INVALID_HOURS', 400));

  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  const orphanMedia = await Media.find({
    status: 'pending',
    entity_id: { $in: [0, null] },
    createdAt: { $lt: cutoffDate },
  });

  let filesDeleted = 0;

  await Promise.all(
    orphanMedia.map(async (media) => {
      const filePath = path.join('uploads', media.entity_type, media.file_name);

      if (fs.existsSync(filePath)) {
        try {
          await fs.promises.unlink(filePath);
          filesDeleted++;
        } catch (err) {
          console.error('Failed to delete file:', filePath, err);
        }
      }
    })
  );
  const { deletedCount } = await Media.deleteMany({
    _id: { $in: orphanMedia.map((m) => m._id) },
  });

  return res.status(200).json({
    ok: true,
    hours,
    result: {
      files_deleted: filesDeleted,
      records_deleted: deletedCount,
    },
  });
});
