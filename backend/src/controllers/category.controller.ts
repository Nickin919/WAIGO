import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Get categories by catalog (top-level only by default)
 */
export const getCategoriesByCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { includeChildren, parentId } = req.query;

    const categories = await prisma.category.findMany({
      where: {
        catalogId,
        ...(parentId === 'null' || !parentId ? { parentId: null } : { parentId: parentId as string })
      },
      include: {
        _count: {
          select: {
            parts: true,
            children: true
          }
        },
        ...(includeChildren === 'true' && {
          children: {
            include: {
              _count: {
                select: { parts: true }
              }
            },
            orderBy: { order: 'asc' }
          }
        })
      },
      orderBy: { order: 'asc' }
    });

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

/**
 * Get category by ID with full details
 */
export const getCategoryById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true
          }
        },
        children: {
          include: {
            _count: {
              select: { parts: true }
            }
          },
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            parts: true
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

/**
 * Get category children
 */
export const getCategoryChildren = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const children = await prisma.category.findMany({
      where: { parentId: id },
      include: {
        _count: {
          select: {
            parts: true,
            children: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    res.json(children);
  } catch (error) {
    console.error('Get category children error:', error);
    res.status(500).json({ error: 'Failed to fetch category children' });
  }
};

/**
 * Get breadcrumb trail for category
 */
export const getCategoryBreadcrumb = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const breadcrumb = [];

    let currentId: string | null = id;
    
    while (currentId) {
      const category = await prisma.category.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          name: true,
          parentId: true
        }
      });

      if (!category) break;

      breadcrumb.unshift(category);
      currentId = category.parentId;
    }

    res.json(breadcrumb);
  } catch (error) {
    console.error('Get breadcrumb error:', error);
    res.status(500).json({ error: 'Failed to fetch breadcrumb' });
  }
};

/**
 * Create new category
 */
export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { catalogId, parentId, name, shortText, longText, thumbnailUrl, order } = req.body;

    if (!catalogId || !name) {
      res.status(400).json({ error: 'catalogId and name are required' });
      return;
    }

    const category = await prisma.category.create({
      data: {
        catalogId,
        parentId: parentId || null,
        name,
        shortText,
        longText,
        thumbnailUrl,
        order: order || 0
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

/**
 * Update category
 */
export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, shortText, longText, thumbnailUrl, order, parentId } = req.body;

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(shortText !== undefined && { shortText }),
        ...(longText !== undefined && { longText }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(order !== undefined && { order }),
        ...(parentId !== undefined && { parentId })
      }
    });

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

/**
 * Delete category
 */
export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if category has children
    const childrenCount = await prisma.category.count({
      where: { parentId: id }
    });

    if (childrenCount > 0) {
      res.status(400).json({ error: 'Cannot delete category with children' });
      return;
    }

    // Check if category has parts
    const partsCount = await prisma.part.count({
      where: { categoryId: id }
    });

    if (partsCount > 0) {
      res.status(400).json({ error: 'Cannot delete category with parts' });
      return;
    }

    await prisma.category.delete({
      where: { id }
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

/**
 * Reorder category
 */
export const reorderCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      res.status(400).json({ error: 'Order must be a number' });
      return;
    }

    const category = await prisma.category.update({
      where: { id },
      data: { order }
    });

    res.json(category);
  } catch (error) {
    console.error('Reorder category error:', error);
    res.status(500).json({ error: 'Failed to reorder category' });
  }
};
