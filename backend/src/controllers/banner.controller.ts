import { Response } from 'express';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { uploadToR2, deleteFromR2, getPublicUrl, R2_PUBLIC_BUCKET } from '../lib/r2';

/** GET /api/banners — list all active banners (admin: all; others: active only) */
export const listBanners = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = (req.user?.role || '').toUpperCase() === 'ADMIN';
    const banners = await prisma.quoteBanner.findMany({
      where: isAdmin ? undefined : { active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(banners);
  } catch (error) {
    console.error('List banners error:', error);
    res.status(500).json({ error: 'Failed to list banners' });
  }
};

/** POST /api/banners — upload a new banner image (admin only) */
export const uploadBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Image file required' });
      return;
    }
    const label = typeof req.body.label === 'string' ? req.body.label.trim() : null;
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const key = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    await uploadToR2(R2_PUBLIC_BUCKET, key, req.file.buffer, req.file.mimetype);
    const url = getPublicUrl(key);

    const banner = await prisma.quoteBanner.create({
      data: { url, r2Key: key, label: label || null },
    });
    res.status(201).json(banner);
  } catch (error) {
    console.error('Upload banner error:', error);
    res.status(500).json({ error: 'Failed to upload banner' });
  }
};

/** PATCH /api/banners/:id — update label, active status, or order (admin only) */
export const updateBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { label, active, order } = req.body;
    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = typeof label === 'string' ? label.trim() || null : null;
    if (active !== undefined) data.active = Boolean(active);
    if (order !== undefined) data.order = Number(order);

    const banner = await prisma.quoteBanner.update({ where: { id }, data });
    res.json(banner);
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ error: 'Failed to update banner' });
  }
};

/** DELETE /api/banners/:id — delete banner and remove from R2 (admin only) */
export const deleteBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const banner = await prisma.quoteBanner.findUnique({ where: { id } });
    if (!banner) {
      res.status(404).json({ error: 'Banner not found' });
      return;
    }
    await prisma.quoteBanner.delete({ where: { id } });
    deleteFromR2(R2_PUBLIC_BUCKET, banner.r2Key).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
};

/** GET a single random active banner URL (used internally by PDF generator) */
export async function getRandomBannerUrl(): Promise<string | null> {
  const banners = await prisma.quoteBanner.findMany({
    where: { active: true },
    select: { url: true },
  });
  if (banners.length === 0) return null;
  return banners[Math.floor(Math.random() * banners.length)].url;
}
