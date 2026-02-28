import path from 'path';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { sendVideoApprovalEmail } from '../lib/email';
import { uploadToR2, getPublicUrl, deleteFromR2, R2_PUBLIC_BUCKET } from '../lib/r2';

/**
 * Get videos by part
 */
export const getVideosByPart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { partId } = req.params;
    const { level } = req.query;

    const where: any = {
      partId,
      status: 'APPROVED'
    };

    if (level) {
      where.level = parseInt(level as string);
    }

    const videos = await prisma.video.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            views: true,
            comments: true
          }
        }
      },
      orderBy: [
        { level: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(videos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

/**
 * Get video by ID
 */
export const getVideoById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        part: {
          include: {
            category: true
          }
        },
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            views: true,
            comments: true
          }
        }
      }
    });

    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    res.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
};

/**
 * Upload new video
 */
export const uploadVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { partId, title, description, level, videoUrl } = req.body;

    // Video URL can come from an uploaded file (pushed to R2) or an external URL
    let finalVideoUrl = videoUrl as string | undefined;
    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.mp4';
      const key = `videos/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      await uploadToR2(R2_PUBLIC_BUCKET, key, req.file.buffer, req.file.mimetype);
      finalVideoUrl = getPublicUrl(key);
    }

    if (!partId || !title || !finalVideoUrl) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const video = await prisma.video.create({
      data: {
        partId,
        videoUrl: finalVideoUrl,
        title,
        description,
        level: level ? parseInt(level) : 1,
        status: 'PENDING',
        uploadedById: req.user.id
      }
    });

    res.status(201).json(video);
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
};

/**
 * Track video view
 */
export const trackVideoView = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Upsert user video view
    const view = await prisma.userVideoView.upsert({
      where: {
        userId_videoId: {
          userId: req.user.id,
          videoId: id
        }
      },
      update: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date()
      },
      create: {
        userId: req.user.id,
        videoId: id,
        viewCount: 1,
        lastViewedAt: new Date()
      }
    });

    res.json(view);
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
};

/**
 * Get pending videos (admin)
 */
export const getPendingVideos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const videos = await prisma.video.findMany({
      where: { status: 'PENDING' },
      include: {
        part: {
          include: {
            category: true
          }
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(videos);
  } catch (error) {
    console.error('Get pending videos error:', error);
    res.status(500).json({ error: 'Failed to fetch pending videos' });
  }
};

/**
 * Approve video (admin)
 */
export const approveVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const video = await prisma.video.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: req.user.id,
        approvedAt: new Date()
      },
      include: {
        part: {
          include: {
            catalog: {
              include: {
                users: {
                  select: { email: true, firstName: true }
                }
              }
            }
          }
        }
      }
    });

    // Send notifications to catalog users
    if (video.part) {
      for (const user of video.part.catalog.users) {
        if (user.email) {
          sendVideoApprovalEmail(user.email, video.title, video.part.partNumber)
            .catch(console.error);
        }
      }
    }

    res.json(video);
  } catch (error) {
    console.error('Approve video error:', error);
    res.status(500).json({ error: 'Failed to approve video' });
  }
};

/**
 * Reject video (admin)
 */
export const rejectVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const video = await prisma.video.update({
      where: { id },
      data: {
        status: 'REJECTED'
      }
    });

    res.json(video);
  } catch (error) {
    console.error('Reject video error:', error);
    res.status(500).json({ error: 'Failed to reject video' });
  }
};

/**
 * Delete video (admin)
 */
export const deleteVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const video = await prisma.video.findUnique({ where: { id }, select: { videoUrl: true } });
    await prisma.video.delete({ where: { id } });

    // Remove from R2 if it was stored there
    if (video?.videoUrl) {
      const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
      if (publicBase && video.videoUrl.startsWith(publicBase)) {
        const key = video.videoUrl.slice(publicBase.length + 1);
        deleteFromR2(R2_PUBLIC_BUCKET, key).catch((err) =>
          console.warn('R2 video delete skipped:', err)
        );
      }
    }

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};

/**
 * GET /api/videos/feed?catalogId= – video feed for a project book
 * Returns all APPROVED videos whose parts are in the given project book (via CatalogItem).
 */
export const getVideoFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.query as { catalogId?: string };
    if (!catalogId) {
      res.status(400).json({ error: 'catalogId is required' });
      return;
    }

    // Collect part IDs that belong to this project book
    const catalogItems = await prisma.catalogItem.findMany({
      where: { catalogId },
      select: { productId: true },
    });
    const partIds = catalogItems.map((i) => i.productId).filter((id): id is string => id !== null);

    if (partIds.length === 0) {
      res.json({ videos: [] });
      return;
    }

    const videos = await prisma.video.findMany({
      where: { partId: { in: partIds }, status: 'APPROVED' },
      include: {
        part: { select: { partNumber: true, description: true } },
        _count: { select: { views: true, comments: true } },
      },
      orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ videos });
  } catch (error) {
    console.error('Get video feed error:', error);
    res.status(500).json({ error: 'Failed to load video feed' });
  }
};
