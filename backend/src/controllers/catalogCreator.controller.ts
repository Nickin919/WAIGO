import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

interface CreateCatalogData {
  name: string;
  description?: string;
  productIds?: string[];
  categoryIds?: string[];
}

/**
 * Get user's visible catalogs (including subordinates')
 * GET /api/catalogs/my-catalogs
 */
export const getVisibleCatalogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get subordinate user IDs based on hierarchy
    const subordinateIds = await getSubordinateUserIds(req.user.id, req.user.role);

    const catalogs = await prisma.catalog.findMany({
      where: {
        createdById: { in: subordinateIds }
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            catalogItems: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const result = catalogs.map(catalog => ({
      ...catalog,
      creatorName: catalog.createdBy ? 
        `${catalog.createdBy.firstName || ''} ${catalog.createdBy.lastName || ''}`.trim() || catalog.createdBy.email : 
        'Unknown',
      itemCount: catalog._count.catalogItems
    }));

    res.json(result);
  } catch (error) {
    console.error('Get visible catalogs error:', error);
    res.status(500).json({ error: 'Failed to fetch catalogs' });
  }
};

/**
 * Get catalog detail with all products
 * GET /api/catalogs/detail/:id
 */
export const getCatalogDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Check access
    const canAccess = await canAccessCatalog(req.user.id, req.user.role, id);
    if (!canAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const catalog = await prisma.catalog.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!catalog) {
      res.status(404).json({ error: 'Catalog not found' });
      return;
    }

    // Get catalog items
    const catalogItems = await prisma.catalogItem.findMany({
      where: { catalogId: id },
      include: {
        product: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const products = catalogItems
      .filter(item => item.product)
      .map(item => item.product!);

    const categoryIds = catalogItems
      .filter(item => item.categoryId)
      .map(item => item.categoryId!);

    res.json({
      catalog: {
        ...catalog,
        creatorName: catalog.createdBy ? 
          `${catalog.createdBy.firstName || ''} ${catalog.createdBy.lastName || ''}`.trim() || catalog.createdBy.email :
          'Unknown'
      },
      items: {
        products,
        categoryIds
      }
    });
  } catch (error) {
    console.error('Get catalog detail error:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
};

/**
 * Create new catalog with selected products
 * POST /api/catalogs/create
 */
export const createUserCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, description, productIds, categoryIds } = req.body as CreateCatalogData;

    if (!name?.trim()) {
      res.status(400).json({ error: 'Catalog name is required' });
      return;
    }

    // Create catalog
    const catalog = await prisma.catalog.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        createdById: req.user.id,
        isPublic: false
      }
    });

    // Add selected products
    if (productIds && productIds.length > 0) {
      await prisma.catalogItem.createMany({
        data: productIds.map(productId => ({
          catalogId: catalog.id,
          productId
        }))
      });
    }

    // Add selected categories (entire categories)
    if (categoryIds && categoryIds.length > 0) {
      await prisma.catalogItem.createMany({
        data: categoryIds.map(categoryId => ({
          catalogId: catalog.id,
          categoryId
        }))
      });
    }

    res.status(201).json(catalog);
  } catch (error) {
    console.error('Create catalog error:', error);
    res.status(500).json({ error: 'Failed to create catalog' });
  }
};

/**
 * Update catalog (name, description, and products)
 * PATCH /api/catalogs/update/:id
 */
export const updateUserCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { name, description, productIds, categoryIds } = req.body as CreateCatalogData;

    // Check access
    const canAccess = await canAccessCatalog(req.user.id, req.user.role, id);
    if (!canAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update catalog
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();

    const catalog = await prisma.catalog.update({
      where: { id },
      data: updateData
    });

    // Update catalog items if productIds provided
    if (productIds !== undefined) {
      // Delete existing items
      await prisma.catalogItem.deleteMany({
        where: { catalogId: id }
      });

      // Add new items
      if (productIds.length > 0 || (categoryIds && categoryIds.length > 0)) {
        const items = [];
        
        if (productIds.length > 0) {
          items.push(...productIds.map(productId => ({
            catalogId: id,
            productId
          })));
        }
        
        if (categoryIds && categoryIds.length > 0) {
          items.push(...categoryIds.map(categoryId => ({
            catalogId: id,
            categoryId
          })));
        }

        await prisma.catalogItem.createMany({
          data: items
        });
      }
    }

    res.json(catalog);
  } catch (error) {
    console.error('Update catalog error:', error);
    res.status(500).json({ error: 'Failed to update catalog' });
  }
};

/**
 * Delete catalog
 * DELETE /api/catalogs/delete/:id
 */
export const deleteUserCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Check access
    const canAccess = await canAccessCatalog(req.user.id, req.user.role, id);
    if (!canAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.catalog.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete catalog error:', error);
    res.status(500).json({ error: 'Failed to delete catalog' });
  }
};

/**
 * Bulk lookup products by part numbers
 * POST /api/products/lookup-parts
 */
export const lookupPartNumbers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { partNumbers } = req.body;

    if (!Array.isArray(partNumbers)) {
      res.status(400).json({ error: 'partNumbers must be an array' });
      return;
    }

    if (partNumbers.length === 0) {
      res.json({ products: [], notFound: [] });
      return;
    }

    // Look up products by part number
    const foundProducts = await prisma.part.findMany({
      where: {
        partNumber: { in: partNumbers }
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const foundPartNumbers = new Set(foundProducts.map(p => p.partNumber));
    const notFound = partNumbers.filter(pn => !foundPartNumbers.has(pn));

    res.json({
      products: foundProducts,
      notFound
    });
  } catch (error) {
    console.error('Lookup part numbers error:', error);
    res.status(500).json({ error: 'Failed to lookup part numbers' });
  }
};

/**
 * Get all products for catalog creator (with category grouping)
 * GET /api/products/for-catalog
 */
export const getProductsForCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { catalogId } = req.query;

    const products = await prisma.part.findMany({
      where: {
        catalogId: catalogId as string || undefined,
        active: true
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { category: { name: 'asc' } },
        { partNumber: 'asc' }
      ],
      take: 10000 // Reasonable limit
    });

    res.json({ products });
  } catch (error) {
    console.error('Get products for catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

/**
 * Helper: Get subordinate user IDs based on role hierarchy
 */
async function getSubordinateUserIds(userId: string, userRole: string): Promise<string[]> {
  const ids = [userId]; // Always include self

  switch (userRole) {
    case 'ADMIN':
      // Admin sees all catalogs
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      return allUsers.map(u => u.id);

    case 'RSM':
      // RSM sees their distributors and all users under them
      const distributors = await prisma.user.findMany({
        where: { assignedToRsmId: userId },
        select: { id: true }
      });
      const distributorIds = distributors.map(d => d.id);

      const usersUnderDistributors = await prisma.user.findMany({
        where: { assignedToDistributorId: { in: distributorIds } },
        select: { id: true }
      });

      return [...ids, ...distributorIds, ...usersUnderDistributors.map(u => u.id)];

    case 'DISTRIBUTOR':
      // Distributor sees their assigned users
      const assignedUsers = await prisma.user.findMany({
        where: { assignedToDistributorId: userId },
        select: { id: true }
      });

      return [...ids, ...assignedUsers.map(u => u.id)];

    case 'TURNKEY':
      // TurnKey users see team members' catalogs
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { turnkeyTeamId: true }
      });

      if (currentUser?.turnkeyTeamId) {
        const teamMembers = await prisma.user.findMany({
          where: { turnkeyTeamId: currentUser.turnkeyTeamId },
          select: { id: true }
        });
        return teamMembers.map(u => u.id);
      }

      return ids;

    default:
      // BASIC and FREE users see only their own
      return ids;
  }
}

/**
 * Helper: Check if user can access catalog
 */
async function canAccessCatalog(userId: string, userRole: string, catalogId: string): Promise<boolean> {
  const catalog = await prisma.catalog.findUnique({
    where: { id: catalogId },
    select: { createdById: true }
  });

  if (!catalog) return false;

  const subordinateIds = await getSubordinateUserIds(userId, userRole);
  return subordinateIds.includes(catalog.createdById || '');
}
