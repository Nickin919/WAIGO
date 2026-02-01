import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Get all catalogs
 */
export const getAllCatalogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const catalogs = await prisma.catalog.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            parts: true,
            categories: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(catalogs);
  } catch (error) {
    console.error('Get catalogs error:', error);
    res.status(500).json({ error: 'Failed to fetch catalogs' });
  }
};

/**
 * Get catalog by ID
 */
export const getCatalogById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const catalog = await prisma.catalog.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            parts: true,
            categories: true,
            users: true
          }
        }
      }
    });

    if (!catalog) {
      res.status(404).json({ error: 'Catalog not found' });
      return;
    }

    res.json(catalog);
  } catch (error) {
    console.error('Get catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
};

/**
 * Create new catalog
 */
export const createCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const catalog = await prisma.catalog.create({
      data: {
        name,
        description
      }
    });

    res.status(201).json(catalog);
  } catch (error) {
    console.error('Create catalog error:', error);
    res.status(500).json({ error: 'Failed to create catalog' });
  }
};

/**
 * Update catalog
 */
export const updateCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const catalog = await prisma.catalog.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(catalog);
  } catch (error) {
    console.error('Update catalog error:', error);
    res.status(500).json({ error: 'Failed to update catalog' });
  }
};

/**
 * Delete catalog
 */
export const deleteCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.catalog.delete({
      where: { id }
    });

    res.json({ message: 'Catalog deleted successfully' });
  } catch (error) {
    console.error('Delete catalog error:', error);
    res.status(500).json({ error: 'Failed to delete catalog' });
  }
};

/**
 * Get catalog statistics
 */
export const getCatalogStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [partsCount, categoriesCount, videosCount, topCategories] = await Promise.all([
      prisma.part.count({ where: { catalogId: id } }),
      prisma.category.count({ where: { catalogId: id } }),
      prisma.video.count({
        where: {
          part: { catalogId: id },
          status: 'APPROVED'
        }
      }),
      prisma.category.findMany({
        where: { catalogId: id, parentId: null },
        select: {
          id: true,
          name: true,
          _count: {
            select: { parts: true }
          }
        },
        take: 5,
        orderBy: {
          parts: { _count: 'desc' }
        }
      })
    ]);

    res.json({
      partsCount,
      categoriesCount,
      videosCount,
      topCategories
    });
  } catch (error) {
    console.error('Get catalog stats error:', error);
    res.status(500).json({ error: 'Failed to fetch catalog statistics' });
  }
};
