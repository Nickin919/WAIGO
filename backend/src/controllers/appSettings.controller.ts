import { Response } from 'express';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { uploadToR2, deleteFromR2, getPublicUrl, R2_PUBLIC_BUCKET } from '../lib/r2';

const GENERIC_THUMB_URL_KEY = 'genericThumbnailUrl';
const GENERIC_THUMB_R2_KEY = 'genericThumbnailR2Key';

/** GET /api/app-settings/generic-thumbnail */
export const getGenericThumbnail = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: GENERIC_THUMB_URL_KEY } });
    res.json({ url: setting?.value ?? null });
  } catch (error) {
    console.error('Get generic thumbnail error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
};

/** POST /api/app-settings/generic-thumbnail — upload/replace (admin only) */
export const uploadGenericThumbnail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Image file required' });
      return;
    }
    // Delete old if exists
    const oldR2Key = await prisma.appSetting.findUnique({ where: { key: GENERIC_THUMB_R2_KEY } });
    if (oldR2Key?.value) {
      deleteFromR2(R2_PUBLIC_BUCKET, oldR2Key.value).catch(() => {});
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const key = `settings/generic-thumbnail${ext}`;
    await uploadToR2(R2_PUBLIC_BUCKET, key, req.file.buffer, req.file.mimetype);
    const url = getPublicUrl(key);

    await prisma.appSetting.upsert({
      where: { key: GENERIC_THUMB_URL_KEY },
      update: { value: url },
      create: { key: GENERIC_THUMB_URL_KEY, value: url },
    });
    await prisma.appSetting.upsert({
      where: { key: GENERIC_THUMB_R2_KEY },
      update: { value: key },
      create: { key: GENERIC_THUMB_R2_KEY, value: key },
    });

    res.json({ url });
  } catch (error) {
    console.error('Upload generic thumbnail error:', error);
    res.status(500).json({ error: 'Failed to upload generic thumbnail' });
  }
};

/** Delete generic thumbnail (admin only) */
export const deleteGenericThumbnail = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r2Key = await prisma.appSetting.findUnique({ where: { key: GENERIC_THUMB_R2_KEY } });
    if (r2Key?.value) deleteFromR2(R2_PUBLIC_BUCKET, r2Key.value).catch(() => {});
    await prisma.appSetting.deleteMany({ where: { key: { in: [GENERIC_THUMB_URL_KEY, GENERIC_THUMB_R2_KEY] } } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete generic thumbnail error:', error);
    res.status(500).json({ error: 'Failed to delete generic thumbnail' });
  }
};

/** Fetch the generic thumbnail URL (used internally by PDF generator) */
export async function getGenericThumbnailUrl(): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key: GENERIC_THUMB_URL_KEY } });
  return setting?.value ?? null;
}
