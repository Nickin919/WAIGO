import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';
import { logUnmatchedEvent, logUnmatchedEvents } from '../lib/unmatchedLogger';

const router = Router();

/**
 * Feature flags (env-based). Default all true if not set.
 * Set FEATURE_BOM_ANALYZER=false or FEATURE_PROJECTS=false to disable.
 */
router.get('/feature-flags', (_req: Request, res: Response): void => {
  res.json({
    bomAnalyzer: process.env.FEATURE_BOM_ANALYZER !== 'false',
    projects: process.env.FEATURE_PROJECTS !== 'false',
  });
});

/**
 * Product Finder - Search products (FREE user access)
 */
router.get('/parts/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, category, limit = '20' } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters' });
      return;
    }

    const where: any = {
      OR: [
        { partNumber: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } }
      ],
      catalog: { isMaster: true, isActive: true }
    };

    if (category) {
      where.category = {
        name: { contains: category as string, mode: 'insensitive' }
      };
    }

    const parts = await prisma.part.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        catalog: {
          select: {
            id: true,
            name: true
          }
        }
      },
      take: parseInt(limit as string),
      orderBy: { partNumber: 'asc' }
    });

    res.json({
      results: parts.map(part => ({
        id: part.id,
        partNumber: part.partNumber,
        description: part.englishDescription ?? part.description,
        category: part.category.name,
        catalogName: part.catalog.name,
        thumbnailUrl: part.thumbnailUrl
      })),
      total: parts.length
    });
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

/**
 * BOM Cross-Reference Tool - Find WAGO equivalents (FREE user access)
 */
router.post('/cross-reference', async (req: Request, res: Response): Promise<void> => {
  try {
    const { manufacturer, partNumber } = req.body;

    if (!manufacturer || !partNumber) {
      res.status(400).json({ error: 'manufacturer and partNumber are required' });
      return;
    }

    const crossRefs = await prisma.crossReference.findMany({
      where: {
        originalManufacturer: { equals: manufacturer, mode: 'insensitive' },
        originalPartNumber: { equals: partNumber, mode: 'insensitive' }
      },
      include: {
        wagoPart: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { compatibilityScore: 'desc' }
    });

    if (crossRefs.length === 0) {
      logUnmatchedEvent(
        {
          source: 'PUBLIC_CROSS_REF',
          process: 'cross-reference',
          eventType: 'CROSS_REF_NOT_FOUND',
          submittedValue: partNumber,
          submittedField: 'partNumber',
          submittedManufacturer: manufacturer,
          matchedAgainst: 'CrossReference'
        },
        {}
      ).catch(() => {});
      res.json({
        found: false,
        message: 'No WAGO equivalent found for this part'
      });
      return;
    }

    res.json({
      found: true,
      original: {
        manufacturer,
        partNumber
      },
      wagoEquivalents: crossRefs.map(ref => ({
        partNumber: ref.wagoPart.partNumber,
        description: ref.wagoPart.englishDescription ?? ref.wagoPart.description,
        category: ref.wagoPart.category.name,
        compatibilityScore: ref.compatibilityScore,
        notes: ref.notes,
        thumbnailUrl: ref.wagoPart.thumbnailUrl
      }))
    });
  } catch (error) {
    console.error('Cross-reference error:', error);
    res.status(500).json({ error: 'Failed to find cross-reference' });
  }
});

/**
 * Bulk BOM Cross-Reference - Upload BOM and get all equivalents
 */
router.post('/cross-reference/bulk', async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array is required' });
      return;
    }

    // items format: [{ manufacturer, partNumber, quantity?, description? }]
    const results = await Promise.all(
      items.map(async (item) => {
        const crossRefs = await prisma.crossReference.findMany({
          where: {
            originalManufacturer: { equals: item.manufacturer, mode: 'insensitive' },
            originalPartNumber: { equals: item.partNumber, mode: 'insensitive' }
          },
          include: {
            wagoPart: {
              select: {
                partNumber: true,
                description: true,
                englishDescription: true,
                minQty: true,
                packageQty: true
              }
            }
          },
          orderBy: { compatibilityScore: 'desc' },
          take: 1 // Best match only
        });

        return {
          original: {
            manufacturer: item.manufacturer,
            partNumber: item.partNumber,
            quantity: item.quantity,
            description: item.description
          },
          wagoEquivalent: crossRefs.length > 0 ? {
            partNumber: crossRefs[0].wagoPart.partNumber,
            description: crossRefs[0].wagoPart.englishDescription ?? crossRefs[0].wagoPart.description,
            compatibilityScore: crossRefs[0].compatibilityScore,
            notes: crossRefs[0].notes,
            minQty: crossRefs[0].wagoPart.minQty,
            packageQty: crossRefs[0].wagoPart.packageQty
          } : null
        };
      })
    );

    const foundCount = results.filter(r => r.wagoEquivalent !== null).length;

    const noMatchItems = results.filter(r => r.wagoEquivalent === null);
    if (noMatchItems.length > 0) {
      logUnmatchedEvents(
        noMatchItems.map((r) => ({
          source: 'PUBLIC_CROSS_REF_BULK',
          process: 'cross-reference/bulk',
          eventType: 'CROSS_REF_NOT_FOUND',
          submittedValue: r.original.partNumber,
          submittedField: 'partNumber',
          submittedManufacturer: r.original.manufacturer,
          matchedAgainst: 'CrossReference'
        })),
        {}
      ).catch(() => {});
    }

    res.json({
      totalItems: items.length,
      matchesFound: foundCount,
      results
    });
  } catch (error) {
    console.error('Bulk cross-reference error:', error);
    res.status(500).json({ error: 'Failed to process bulk cross-reference' });
  }
});

/**
 * Get public catalogs (FREE / no-login user access).
 * No-login users are restricted to the MASTER catalog only.
 */
router.get('/catalogs', async (req: Request, res: Response): Promise<void> => {
  try {
    const catalogs = await prisma.catalog.findMany({
      where: {
        isMaster: true,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        description: true,
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
    console.error('Get public catalogs error:', error);
    res.status(500).json({ error: 'Failed to fetch catalogs' });
  }
});

/**
 * Create anonymous session for FREE user
 */
router.post('/session/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = randomUUID();

    // Create temporary FREE user with session ID
    const user = await prisma.user.create({
      data: {
        role: 'FREE',
        sessionId,
        lastActiveAt: new Date()
      }
    });

    // Set session cookie
    res.cookie('wago_session', sessionId, {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.json({
      sessionId,
      userId: user.id,
      expiresIn: '24 hours'
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

export default router;
