import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      usersCount,
      catalogsCount,
      partsCount,
      pendingVideosCount,
      projectsCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.catalog.count(),
      prisma.part.count(),
      prisma.video.count({ where: { status: 'PENDING' } }),
      prisma.project.count()
    ]);

    res.json({
      users: usersCount,
      catalogs: catalogsCount,
      parts: partsCount,
      pendingVideos: pendingVideosCount,
      projects: projectsCount
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        catalogId: true,
        isActive: true,
        createdAt: true,
        catalog: {
          select: {
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow password updates through this endpoint
    delete updateData.passwordHash;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        catalogId: true,
        isActive: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export const bulkApproveVideos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { videoIds } = req.body;

    if (!Array.isArray(videoIds)) {
      res.status(400).json({ error: 'videoIds must be an array' });
      return;
    }

    const result = await prisma.video.updateMany({
      where: {
        id: { in: videoIds },
        status: 'PENDING'
      },
      data: {
        status: 'APPROVED',
        approvedById: req.user.id,
        approvedAt: new Date()
      }
    });

    res.json({ message: `${result.count} videos approved` });
  } catch (error) {
    console.error('Bulk approve videos error:', error);
    res.status(500).json({ error: 'Failed to bulk approve videos' });
  }
};

export const importCrossReferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // TODO: Implement CSV import for cross-references
    res.status(501).json({ error: 'Cross-reference import not yet implemented' });
  } catch (error) {
    console.error('Import cross-references error:', error);
    res.status(500).json({ error: 'Failed to import cross-references' });
  }
};
