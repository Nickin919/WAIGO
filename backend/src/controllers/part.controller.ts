import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Get parts by catalog
 */
export const getPartsByCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { search, limit = '50', offset = '0' } = req.query;

    const where: any = { catalogId };

    if (search) {
      where.OR = [
        { partNumber: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [parts, total] = await Promise.all([
      prisma.part.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              videos: true
            }
          }
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { partNumber: 'asc' }
      }),
      prisma.part.count({ where })
    ]);

    res.json({
      parts,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Get parts by catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
};

/**
 * Get parts by category
 */
export const getPartsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params;

    const parts = await prisma.part.findMany({
      where: { categoryId },
      include: {
        _count: {
          select: {
            videos: true
          }
        }
      },
      orderBy: { partNumber: 'asc' }
    });

    res.json(parts);
  } catch (error) {
    console.error('Get parts by category error:', error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
};

/**
 * Get part by ID
 */
export const getPartById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const part = await prisma.part.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        videos: {
          where: { status: 'APPROVED' },
          orderBy: { level: 'asc' },
          include: {
            _count: {
              select: { views: true }
            }
          }
        },
        files: true,
        _count: {
          select: {
            videos: true
          }
        }
      }
    });

    if (!part) {
      res.status(404).json({ error: 'Part not found' });
      return;
    }

    res.json(part);
  } catch (error) {
    console.error('Get part error:', error);
    res.status(500).json({ error: 'Failed to fetch part' });
  }
};

/**
 * Get part by part number
 */
export const getPartByNumber = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { partNumber } = req.params;
    const { catalogId } = req.query;

    if (!catalogId) {
      res.status(400).json({ error: 'catalogId query parameter required' });
      return;
    }

    const part = await prisma.part.findUnique({
      where: {
        catalogId_partNumber: {
          catalogId: catalogId as string,
          partNumber
        }
      },
      include: {
        category: true,
        videos: {
          where: { status: 'APPROVED' }
        }
      }
    });

    if (!part) {
      res.status(404).json({ error: 'Part not found' });
      return;
    }

    res.json(part);
  } catch (error) {
    console.error('Get part by number error:', error);
    res.status(500).json({ error: 'Failed to fetch part' });
  }
};

/**
 * Create new part
 */
export const createPart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      catalogId,
      categoryId,
      partNumber,
      description,
      thumbnailUrl,
      minQty,
      packageQty,
      level,
      basePrice
    } = req.body;

    if (!catalogId || !categoryId || !partNumber || !description) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const part = await prisma.part.create({
      data: {
        catalogId,
        categoryId,
        partNumber,
        description,
        thumbnailUrl,
        minQty: minQty || 1,
        packageQty: packageQty || 1,
        level: level || 1,
        basePrice
      }
    });

    res.status(201).json(part);
  } catch (error) {
    console.error('Create part error:', error);
    res.status(500).json({ error: 'Failed to create part' });
  }
};

/**
 * Update part
 */
export const updatePart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      partNumber,
      description,
      thumbnailUrl,
      minQty,
      packageQty,
      level,
      basePrice
    } = req.body;

    const part = await prisma.part.update({
      where: { id },
      data: {
        ...(categoryId && { categoryId }),
        ...(partNumber && { partNumber }),
        ...(description && { description }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(minQty !== undefined && { minQty }),
        ...(packageQty !== undefined && { packageQty }),
        ...(level !== undefined && { level }),
        ...(basePrice !== undefined && { basePrice })
      }
    });

    res.json(part);
  } catch (error) {
    console.error('Update part error:', error);
    res.status(500).json({ error: 'Failed to update part' });
  }
};

/**
 * Delete part
 */
export const deletePart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.part.delete({
      where: { id }
    });

    res.json({ message: 'Part deleted successfully' });
  } catch (error) {
    console.error('Delete part error:', error);
    res.status(500).json({ error: 'Failed to delete part' });
  }
};
