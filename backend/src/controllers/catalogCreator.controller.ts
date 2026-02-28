import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getSubordinateUserIds } from '../lib/hierarchy';
import { logUnmatchedEvents } from '../lib/unmatchedLogger';

interface CreateCatalogData {
  name: string;
  description?: string;
  sourceCatalogId?: string;
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
        },
        sourceCatalog: {
          select: {
            id: true,
            name: true,
            isMaster: true
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

    const { name, description, sourceCatalogId, productIds, categoryIds } = req.body as CreateCatalogData;

    if (!name?.trim()) {
      res.status(400).json({ error: 'Catalog name is required' });
      return;
    }

    const createData: { name: string; description?: string | null; createdById: string; isPublic: boolean; sourceCatalogId?: string | null } = {
      name: name.trim(),
      description: description?.trim() ?? null,
      createdById: req.user.id,
      isPublic: false
    };
    if (sourceCatalogId) createData.sourceCatalogId = sourceCatalogId;

    const catalog = await prisma.catalog.create({
      data: createData
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
    const { name, description, sourceCatalogId, productIds, categoryIds } = req.body as CreateCatalogData;

    // Check access
    const canAccess = await canAccessCatalog(req.user.id, req.user.role, id);
    if (!canAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const updateData: { updatedAt: Date; name?: string; description?: string | null; sourceCatalogId?: string | null } = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (sourceCatalogId !== undefined) updateData.sourceCatalogId = sourceCatalogId || null;

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

    // Resolve blocking references (DB FKs were re-added without ON DELETE)
    const masterCatalog = await prisma.catalog.findFirst({
      where: { isMaster: true, isActive: true, id: { not: id } },
      select: { id: true }
    });
    const quotesUsingCatalog = await prisma.quote.count({ where: { catalogId: id } });
    if (quotesUsingCatalog > 0 && !masterCatalog) {
      res.status(400).json({
        error: 'Cannot delete project book',
        detail: `${quotesUsingCatalog} quote(s) use this project book. Reassign them to another project book first, or ensure a Master project book exists.`
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Clear or reassign references so FK constraints allow delete
      await tx.user.updateMany({ where: { catalogId: id }, data: { catalogId: null } });
      await tx.project.updateMany({ where: { catalogId: id }, data: { catalogId: null } });
      if (masterCatalog && quotesUsingCatalog > 0) {
        await tx.quote.updateMany({ where: { catalogId: id }, data: { catalogId: masterCatalog.id } });
      }
      await tx.catalog.updateMany({ where: { sourceCatalogId: id }, data: { sourceCatalogId: null } });
      // Delete dependents in order (Part → Category due to Part.categoryId)
      await tx.catalogItem.deleteMany({ where: { catalogId: id } });
      await tx.part.deleteMany({ where: { catalogId: id } });
      await tx.category.deleteMany({ where: { catalogId: id } });
      await tx.catalogAssignment.deleteMany({ where: { catalogId: id } });
      await tx.catalog.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete catalog error:', error);
    res.status(500).json({ error: 'Failed to delete catalog' });
  }
};

/**
 * Get catalogs that can be used as source when building a new catalog: MASTER (if any) + user's visible catalogs.
 * GET /api/catalog-creator/source-catalogs
 */
export const getSourceCatalogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const subordinateIds = await getSubordinateUserIds(req.user.id, req.user.role);

    const [masterCatalog, visibleCatalogs] = await Promise.all([
      prisma.catalog.findFirst({
        where: { isMaster: true, isActive: true },
        select: { id: true, name: true, isMaster: true, sourceCatalogId: true }
      }),
      prisma.catalog.findMany({
        where: { createdById: { in: subordinateIds }, isActive: true },
        select: { id: true, name: true, isMaster: true, sourceCatalogId: true },
        orderBy: { name: 'asc' }
      })
    ]);

    const list = [];
    if (masterCatalog) list.push({ ...masterCatalog, label: `${masterCatalog.name} (MASTER)` });
    visibleCatalogs.forEach(c => {
      if (c.id !== masterCatalog?.id) list.push({ ...c, label: c.name });
    });

    res.json({ sourceCatalogs: list });
  } catch (error) {
    console.error('Get source catalogs error:', error);
    res.status(500).json({ error: 'Failed to fetch source catalogs' });
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

    if (notFound.length > 0) {
      logUnmatchedEvents(
        notFound.map((pn) => ({
          source: 'CATALOG_CREATOR_LOOKUP',
          process: 'lookupPartNumbers',
          eventType: 'PART_NOT_FOUND',
          submittedValue: pn,
          submittedField: 'partNumber',
          matchedAgainst: 'Part'
        })),
        { userId: req.user?.id ?? undefined }
      ).catch(() => {});
    }

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
 * Get all products for catalog creator (with category grouping).
 * Source catalog determines products: MASTER = Parts owned by that catalog; secondary = Parts resolved via CatalogItem -> Part.
 * GET /api/catalog-creator/products-for-catalog?sourceCatalogId=<id>
 */
export const getProductsForCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const sourceCatalogId = req.query.sourceCatalogId as string | undefined;
    if (!sourceCatalogId) {
      res.status(400).json({ error: 'sourceCatalogId is required. Use the MASTER catalog or a catalog built from it.' });
      return;
    }

    const sourceCatalog = await prisma.catalog.findUnique({
      where: { id: sourceCatalogId },
      select: { id: true, isMaster: true }
    });
    if (!sourceCatalog) {
      res.status(404).json({ error: 'Source catalog not found' });
      return;
    }

    const subordinateIds = await getSubordinateUserIds(req.user.id, req.user.role);
    const masterCatalog = await prisma.catalog.findFirst({
      where: { isMaster: true },
      select: { id: true }
    });
    const visibleCatalogIds = await prisma.catalog.findMany({
      where: { createdById: { in: subordinateIds } },
      select: { id: true }
    }).then(c => c.map(x => x.id));
    if (!visibleCatalogIds.includes(sourceCatalogId) && sourceCatalogId !== masterCatalog?.id) {
      res.status(403).json({ error: 'Access denied to source catalog' });
      return;
    }

    if (sourceCatalog.isMaster) {
      const PRODUCT_LIMIT = 5000;
      const totalCount = await prisma.part.count({ where: { catalogId: sourceCatalogId, active: true } });
      const products = await prisma.part.findMany({
        where: {
          catalogId: sourceCatalogId,
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
        take: PRODUCT_LIMIT
      });
      res.json({ products, totalCount });
      return;
    }

    const catalogItems = await prisma.catalogItem.findMany({
      where: {
        catalogId: sourceCatalogId,
        productId: { not: null }
      },
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
        }
      }
    });
    const seen = new Set<string>();
    const products = catalogItems
      .filter(item => item.product && !seen.has(item.product!.id))
      .map(item => {
        seen.add(item.product!.id);
        return item.product!;
      })
      .sort((a, b) => {
        const catA = a.category?.name ?? '';
        const catB = b.category?.name ?? '';
        return catA.localeCompare(catB) || a.partNumber.localeCompare(b.partNumber);
      });
    res.json({ products });
  } catch (error) {
    console.error('Get products for catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

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
