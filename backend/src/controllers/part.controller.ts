import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { logUnmatchedEvents } from '../lib/unmatchedLogger';

/**
 * Get parts by catalog
 */
export const getPartsByCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { search, limit = '50', offset = '0' } = req.query;
    const take = parseInt(limit as string);
    const skip = parseInt(offset as string);

    // Determine catalog type: Master Catalog owns parts directly (Part.catalogId).
    // Project Books reference parts via CatalogItem. Resolve accordingly.
    const catalog = await prisma.catalog.findUnique({
      where: { id: catalogId },
      select: { isMaster: true },
    });

    let baseWhere: any;

    if (!catalog || catalog.isMaster) {
      // Master Catalog: query by Part.catalogId
      baseWhere = { catalogId };
    } else {
      // Project Book: resolve parts via CatalogItem
      const items = await prisma.catalogItem.findMany({
        where: { catalogId, productId: { not: null } },
        select: { productId: true },
      });
      const partIds = items.map((i) => i.productId).filter((id): id is string => id !== null);
      if (partIds.length === 0) {
        res.json({ parts: [], total: 0, limit: take, offset: skip });
        return;
      }
      baseWhere = { id: { in: partIds } };
    }

    const searchFilter = search
      ? {
          OR: [
            { partNumber: { contains: search as string, mode: 'insensitive' } },
            { description: { contains: search as string, mode: 'insensitive' } },
          ],
        }
      : null;

    const where = searchFilter ? { AND: [baseWhere, searchFilter] } : baseWhere;

    const [parts, total] = await Promise.all([
      prisma.part.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { videos: true } },
        },
        take,
        skip,
        orderBy: { partNumber: 'asc' },
      }),
      prisma.part.count({ where }),
    ]);

    res.json({ parts, total, limit: take, offset: skip });
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
 * Bulk lookup parts by part numbers (for quote bulk import)
 * POST /api/parts/lookup-bulk
 * Body: { partNumbers: string[], catalogId: string }
 */
export const lookupBulkParts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { partNumbers, catalogId } = req.body;

    if (!Array.isArray(partNumbers) || !catalogId) {
      res.status(400).json({ error: 'partNumbers (array) and catalogId are required' });
      return;
    }

    const trimmed = partNumbers
      .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p: string) => p.length > 0);

    const unique = [...new Set(trimmed)];

    if (unique.length === 0) {
      res.json({ found: [], notFound: [] });
      return;
    }

    const parts = await prisma.part.findMany({
      where: {
        catalogId,
        OR: unique.map((pn: string) => ({ partNumber: { equals: pn, mode: 'insensitive' as const } }))
      },
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });

    const foundPartNumbers = new Set(parts.map((p) => p.partNumber.toLowerCase()));
    const notFound = unique.filter((pn) => !foundPartNumbers.has(pn.toLowerCase()));

    if (notFound.length > 0) {
      logUnmatchedEvents(
        notFound.map((pn) => ({
          source: 'PART_LOOKUP_BULK',
          process: 'lookupBulkParts',
          eventType: 'PART_NOT_FOUND',
          submittedValue: pn,
          submittedField: 'partNumber',
          matchedAgainst: 'Part'
        })),
        { userId: req.user?.id ?? undefined }
      ).catch(() => {});
    }

    res.json({ found: parts, notFound });
  } catch (error) {
    console.error('Lookup bulk parts error:', error);
    res.status(500).json({ error: 'Failed to lookup parts' });
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
      basePrice,
      series,
      englishDescription,
      active,
      gridLevelNumber,
      gridLevelName,
      gridSublevelNumber,
      gridSublevelName,
      listPricePer100,
      distributorDiscount,
      wagoIdent,
      priceDate
    } = req.body;

    const data: Record<string, unknown> = {};
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (partNumber !== undefined) data.partNumber = partNumber;
    if (description !== undefined) data.description = description;
    if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl;
    if (minQty !== undefined) data.minQty = minQty;
    if (packageQty !== undefined) data.packageQty = packageQty;
    if (level !== undefined) data.level = level;
    if (basePrice !== undefined) data.basePrice = basePrice;
    if (series !== undefined) data.series = series;
    if (englishDescription !== undefined) data.englishDescription = englishDescription;
    if (active !== undefined) data.active = Boolean(active);
    if (gridLevelNumber !== undefined) data.gridLevelNumber = gridLevelNumber == null ? null : Number(gridLevelNumber);
    if (gridLevelName !== undefined) data.gridLevelName = gridLevelName;
    if (gridSublevelNumber !== undefined) data.gridSublevelNumber = gridSublevelNumber == null ? null : Number(gridSublevelNumber);
    if (gridSublevelName !== undefined) data.gridSublevelName = gridSublevelName;
    if (listPricePer100 !== undefined) data.listPricePer100 = listPricePer100 == null ? null : Number(listPricePer100);
    if (distributorDiscount !== undefined) data.distributorDiscount = Number(distributorDiscount);
    if (wagoIdent !== undefined) data.wagoIdent = wagoIdent;
    if (priceDate !== undefined) data.priceDate = priceDate ? new Date(priceDate) : null;

    const part = await prisma.part.update({
      where: { id },
      data: data as any
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
