import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

interface ImportProduct {
  partNumber: string;
  series?: string | null;
  description?: string | null;
  englishDescription?: string | null;
  category?: string;
  price?: number | null;
  listPricePer100?: number | null;
  wagoIdent?: string | null;
  distributorDiscount?: number | null;
  minQty?: number | null;
  active?: boolean;
}

interface ImportResult {
  created: number;
  updated: number;
  priceChanges: number;
  notFound: string[];
  errors: string[];
  importBatch: string;
}

/**
 * Bulk import products from CSV with upsert logic
 * POST /api/admin/products/import
 */
export const bulkImportProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { products, updateOnly, catalogId } = req.body;

    // Validation
    if (!Array.isArray(products)) {
      res.status(400).json({ error: 'Products must be an array' });
      return;
    }

    if (products.length === 0) {
      res.status(400).json({ error: 'No products to import' });
      return;
    }

    if (products.length > 25000) {
      res.status(400).json({ error: 'Maximum 25,000 products per import' });
      return;
    }

    if (!catalogId) {
      res.status(400).json({ error: 'catalogId is required' });
      return;
    }

    // Process import
    const result = await processProductImport(
      products as ImportProduct[],
      req.user.id,
      catalogId,
      updateOnly || false
    );

    res.json(result);
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to import products' });
  }
};

/**
 * Clear all products (Parts) - optionally scoped to a catalog
 * DELETE /api/admin/products/clear
 * Body: { catalogId?: string } - if omitted, clears all catalogs
 */
export const clearProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const catalogId = req.body?.catalogId || req.query?.catalogId;

    const whereClause = catalogId ? { catalogId } : {};

    // Get part IDs we're about to delete (for cleaning up references)
    const parts = await prisma.part.findMany({
      where: whereClause,
      select: { id: true }
    });
    const partIds = parts.map((p) => p.id);

    if (partIds.length === 0) {
      res.json({ deleted: 0, message: 'No products to clear' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Remove quote items that reference these parts
      await tx.quoteItem.deleteMany({ where: { partId: { in: partIds } } });
      // Unlink project items (partId becomes null)
      await tx.projectItem.updateMany({
        where: { partId: { in: partIds } },
        data: { partId: null },
      });
      // Delete parts (cascades: PriceHistory, PartFile, Video, CatalogItem, CrossReference)
      await tx.part.deleteMany({ where: whereClause });
    });

    res.json({
      deleted: partIds.length,
      message: catalogId
        ? `Cleared ${partIds.length} products from catalog`
        : `Cleared ${partIds.length} products from all catalogs`
    });
  } catch (error) {
    console.error('Clear products error:', error);
    res.status(500).json({ error: 'Failed to clear products' });
  }
};

/**
 * Process product import with upsert logic
 */
async function processProductImport(
  productsData: ImportProduct[],
  userId: string,
  catalogId: string,
  updateOnly: boolean
): Promise<ImportResult> {
  let created = 0;
  let updated = 0;
  let priceChanges = 0;
  const notFound: string[] = [];
  const errors: string[] = [];
  const importBatch = `import_${Date.now()}`;

  // Get default category for the catalog (or create one)
  let defaultCategory = await prisma.category.findFirst({
    where: { catalogId, name: 'Imported Products' }
  });

  if (!defaultCategory) {
    defaultCategory = await prisma.category.create({
      data: {
        catalogId,
        name: 'Imported Products',
        shortText: 'Products imported from CSV',
        order: 999
      }
    });
  }

  for (let i = 0; i < productsData.length; i++) {
    const row = productsData[i];
    const partNumber = row.partNumber?.toString().trim();

    if (!partNumber) {
      errors.push(`Row ${i + 1}: Missing Part Number`);
      continue;
    }

    try {
      // Check if product exists (by part number in this catalog)
      const existing = await prisma.part.findUnique({
        where: {
          catalogId_partNumber: {
            catalogId,
            partNumber
          }
        }
      });

      if (existing) {
        // UPDATE existing product
        const updateData: any = { updatedAt: new Date() };

        // Only update fields that are provided
        if (row.series !== undefined) updateData.series = row.series?.toString().trim() || null;
        if (row.description !== undefined) updateData.description = row.description?.toString().trim() || '';
        if (row.englishDescription !== undefined) updateData.englishDescription = row.englishDescription?.toString().trim() || null;
        if (row.distributorDiscount !== undefined) {
          const discount = parseFloat(String(row.distributorDiscount)) || 0;
          updateData.distributorDiscount = discount;
        }
        if (row.minQty !== undefined) {
          const minQty = parseInt(String(row.minQty)) || 1;
          updateData.minQty = minQty;
        }
        if (row.wagoIdent !== undefined) updateData.wagoIdent = row.wagoIdent?.toString().trim() || null;
        if (row.listPricePer100 !== undefined) {
          const price100 = parseFloat(String(row.listPricePer100)) || null;
          updateData.listPricePer100 = price100;
        }
        if (row.active !== undefined) updateData.active = Boolean(row.active);

        // Find category if provided
        if (row.category) {
          const categoryName = row.category.toString().trim();
          let category = await prisma.category.findFirst({
            where: {
              catalogId,
              name: { equals: categoryName, mode: 'insensitive' }
            }
          });

          if (!category) {
            // Create category if it doesn't exist
            category = await prisma.category.create({
              data: {
                catalogId,
                name: categoryName,
                order: 100 + i
              }
            });
          }

          updateData.categoryId = category.id;
        }

        // Handle price updates with history tracking
        if (row.price !== undefined && row.price !== null) {
          const newPrice = parseFloat(String(row.price)) || 0;
          const oldPrice = existing.basePrice || 0;

          if (oldPrice !== newPrice && newPrice > 0) {
            // Log price change
            await prisma.priceHistory.create({
              data: {
                partId: existing.id,
                partNumber,
                oldPrice,
                newPrice,
                changedById: userId,
                importBatch
              }
            });
            priceChanges++;
            updateData.basePrice = newPrice;
          }
        }

        await prisma.part.update({
          where: { id: existing.id },
          data: updateData
        });

        updated++;
      } else if (updateOnly) {
        // Update-only mode: track not found items
        notFound.push(partNumber);
      } else {
        // CREATE new product
        const categoryName = row.category?.toString().trim();
        const newPrice = parseFloat(String(row.price)) || 0;

        if (!categoryName) {
          errors.push(`Row ${i + 1}: Missing Category (required for new products)`);
          continue;
        }

        if (!newPrice || newPrice <= 0) {
          errors.push(`Row ${i + 1}: Missing or invalid Price (required for new products)`);
          continue;
        }

        // Find or create category
        let category = await prisma.category.findFirst({
          where: {
            catalogId,
            name: { equals: categoryName, mode: 'insensitive' }
          }
        });

        if (!category) {
          category = await prisma.category.create({
            data: {
              catalogId,
              name: categoryName,
              order: 100 + i
            }
          });
        }

        await prisma.part.create({
          data: {
            catalogId,
            categoryId: category.id,
            partNumber,
            series: row.series?.toString().trim() || null,
            description: row.description?.toString().trim() || '',
            englishDescription: row.englishDescription?.toString().trim() || null,
            basePrice: newPrice,
            listPricePer100: row.listPricePer100 ? parseFloat(String(row.listPricePer100)) : null,
            wagoIdent: row.wagoIdent?.toString().trim() || null,
            distributorDiscount: row.distributorDiscount ? parseFloat(String(row.distributorDiscount)) : 0,
            minQty: row.minQty ? parseInt(String(row.minQty)) : 1,
            packageQty: row.minQty ? parseInt(String(row.minQty)) : 1,
            active: row.active !== undefined ? Boolean(row.active) : true
          }
        });

        created++;
      }
    } catch (error: any) {
      errors.push(`Row ${i + 1} (${partNumber}): ${error.message}`);
    }
  }

  return {
    created,
    updated,
    priceChanges,
    notFound,
    errors,
    importBatch
  };
}

/**
 * Get price history for a product
 * GET /api/admin/products/:partNumber/price-history
 */
export const getPriceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { partNumber } = req.params;
    const { catalogId } = req.query;

    if (!catalogId) {
      res.status(400).json({ error: 'catalogId query parameter required' });
      return;
    }

    // Find the part
    const part = await prisma.part.findUnique({
      where: {
        catalogId_partNumber: {
          catalogId: catalogId as string,
          partNumber
        }
      }
    });

    if (!part) {
      res.status(404).json({ error: 'Part not found' });
      return;
    }

    // Get price history
    const history = await prisma.priceHistory.findMany({
      where: { partId: part.id },
      include: {
        changedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { changedAt: 'desc' },
      take: 50
    });

    res.json({
      partNumber,
      currentPrice: part.basePrice,
      history
    });
  } catch (error) {
    console.error('Get price history error:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
};

/**
 * Get import batch summary
 * GET /api/admin/products/import-batch/:batchId
 */
export const getImportBatchSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { batchId } = req.params;

    const priceChanges = await prisma.priceHistory.findMany({
      where: { importBatch: batchId },
      include: {
        part: {
          select: {
            partNumber: true,
            description: true,
            category: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { changedAt: 'desc' }
    });

    res.json({
      batchId,
      totalChanges: priceChanges.length,
      changes: priceChanges
    });
  } catch (error) {
    console.error('Get batch summary error:', error);
    res.status(500).json({ error: 'Failed to fetch batch summary' });
  }
};

/**
 * Get import statistics
 * GET /api/admin/products/import-stats
 */
export const getImportStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { catalogId } = req.query;

    if (!catalogId) {
      res.status(400).json({ error: 'catalogId query parameter required' });
      return;
    }

    const [totalParts, activeParts, totalPriceChanges, recentImports] = await Promise.all([
      prisma.part.count({ where: { catalogId: catalogId as string } }),
      prisma.part.count({ where: { catalogId: catalogId as string, active: true } }),
      prisma.priceHistory.count(),
      prisma.priceHistory.groupBy({
        by: ['importBatch'],
        _count: { id: true },
        orderBy: { importBatch: 'desc' },
        take: 10
      })
    ]);

    res.json({
      totalParts,
      activeParts,
      inactiveParts: totalParts - activeParts,
      totalPriceChanges,
      recentImports: recentImports.filter(r => r.importBatch)
    });
  } catch (error) {
    console.error('Get import stats error:', error);
    res.status(500).json({ error: 'Failed to fetch import statistics' });
  }
};
