import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
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

const CROSS_REF_SAMPLE = 'originalManufacturer,originalPartNumber,wagoPartNumber,compatibilityScore,notes\nPhoenix Contact,1234567,221-413,1.0,WAGO equivalent for terminal block\n';
const NON_WAGO_SAMPLE = 'manufacturer,partNumber,description,category\nPhoenix Contact,1234567,Terminal block 2.5mm,Terminals\n';

export const getCrossReferencesSample = (_req: AuthRequest, res: Response): void => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="cross-references-sample.csv"');
  res.send(CROSS_REF_SAMPLE);
};

export const importCrossReferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = (req as any).file;
    if (!file?.path) {
      res.status(400).json({ error: 'No CSV file uploaded' });
      return;
    }
    const replace = req.query.replace === 'true' || req.query.replace === '1';
    const raw = fs.readFileSync(file.path, 'utf-8');
    fs.unlinkSync(file.path);

    const parsed = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
    const rows = parsed.data?.filter(
      (r) => r.originalManufacturer?.trim() && r.originalPartNumber?.trim() && r.wagoPartNumber?.trim()
    ) || [];
    if (rows.length === 0) {
      res.status(400).json({ error: 'No valid rows. Required columns: originalManufacturer, originalPartNumber, wagoPartNumber' });
      return;
    }

    if (replace) {
      await prisma.crossReference.deleteMany({});
    }

    const importBatchId = `cross_ref_simple_${Date.now()}`;
    const userId = req.user?.id ?? null;
    let created = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const wagoPartNumber = row.wagoPartNumber.trim();
      const wagoPart = await prisma.part.findFirst({
        where: { partNumber: wagoPartNumber },
        select: { id: true }
      });
      if (!wagoPart) {
        errors.push(`WAGO part not found: ${wagoPartNumber}`);
        await prisma.failureReport.create({
          data: {
            source: 'CROSS_REF_IMPORT',
            failureType: 'WAGO_PART_NOT_FOUND',
            importBatchId,
            context: { originalManufacturer: row.originalManufacturer.trim(), originalPartNumber: row.originalPartNumber.trim(), wagoPartNumber },
            message: `Cross-ref import: WAGO part not found: ${wagoPartNumber}`,
            userId
          }
        });
        continue;
      }
      const manu = row.originalManufacturer.trim();
      const pn = row.originalPartNumber.trim();
      const score = Math.min(1, Math.max(0, parseFloat(row.compatibilityScore) || 1));
      const notes = row.notes?.trim() || null;
      try {
        await prisma.crossReference.upsert({
          where: {
            originalManufacturer_originalPartNumber_wagoPartId: {
              originalManufacturer: manu,
              originalPartNumber: pn,
              wagoPartId: wagoPart.id
            }
          },
          create: {
            originalManufacturer: manu,
            originalPartNumber: pn,
            wagoPartId: wagoPart.id,
            compatibilityScore: score,
            notes
          },
          update: { compatibilityScore: score, notes }
        });
        created++;
      } catch (e) {
        errors.push(`Row ${manu}/${pn}: ${(e as Error).message}`);
      }
    }

    res.json({
      created,
      totalRows: rows.length,
      errors: errors.length ? errors : undefined,
      importBatchId
    });
  } catch (error) {
    console.error('Import cross-references error:', error);
    res.status(500).json({ error: 'Failed to import cross-references' });
  }
};

export const getNonWagoProductsSample = (_req: AuthRequest, res: Response): void => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="non-wago-products-sample.csv"');
  res.send(NON_WAGO_SAMPLE);
};

export const importNonWagoProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = (req as any).file;
    if (!file?.path) {
      res.status(400).json({ error: 'No CSV file uploaded' });
      return;
    }
    const replace = req.query.replace === 'true' || req.query.replace === '1';
    const raw = fs.readFileSync(file.path, 'utf-8');
    fs.unlinkSync(file.path);

    const parsed = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
    const rows = parsed.data?.filter(
      (r) => r.manufacturer?.trim() && r.partNumber?.trim()
    ) || [];
    if (rows.length === 0) {
      res.status(400).json({ error: 'No valid rows. Required columns: manufacturer, partNumber' });
      return;
    }

    if (replace) {
      await prisma.nonWagoProduct.deleteMany({});
    }

    let created = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const manufacturer = row.manufacturer.trim();
      const partNumber = row.partNumber.trim();
      const description = row.description?.trim() || null;
      const category = row.category?.trim() || null;
      try {
        await prisma.nonWagoProduct.upsert({
          where: {
            manufacturer_partNumber: { manufacturer, partNumber }
          },
          create: { manufacturer, partNumber, description, category },
          update: { description, category }
        });
        created++;
      } catch (e) {
        errors.push(`Row ${manufacturer}/${partNumber}: ${(e as Error).message}`);
      }
    }

    res.json({
      created,
      totalRows: rows.length,
      errors: errors.length ? errors : undefined
    });
  } catch (error) {
    console.error('Import non-WAGO products error:', error);
    res.status(500).json({ error: 'Failed to import non-WAGO products' });
  }
};

// ---------------------------------------------------------------------------
// MASTER Cross Reference Import (column-mapped, replace or add/merge)
// ---------------------------------------------------------------------------

const MAX_CROSS_REF_ROWS = 25_000;

interface MappedCrossReferenceRow {
  partNumberA?: string | null;
  partNumberB?: string | null;
  manufactureName?: string | null;
  activeItem?: boolean | null;
  estimatedPrice?: number | string | null;
  wagoCrossA?: string | null;
  wagoCrossB?: string | null;
  notesA?: string | null;
  notesB?: string | null;
  author?: string | null;
  lastDateModified?: string | null;
}

function parseOptionalBoolean(v: unknown): boolean | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return null;
}

function parseOptionalDecimal(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function parseOptionalDate(v: unknown): Date | null {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const importCrossReferencesMaster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: rawRows, replace = false } = req.body as { rows?: MappedCrossReferenceRow[]; replace?: boolean };

    if (!Array.isArray(rawRows)) {
      res.status(400).json({ error: 'rows must be an array' });
      return;
    }
    if (rawRows.length === 0) {
      res.status(400).json({ error: 'No rows to import' });
      return;
    }
    if (rawRows.length > MAX_CROSS_REF_ROWS) {
      res.status(400).json({ error: `Maximum ${MAX_CROSS_REF_ROWS} rows per import` });
      return;
    }

    const userId = req.user?.id ?? null;
    const importBatchId = `cross_ref_${Date.now()}`;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    if (replace) {
      await prisma.crossReference.deleteMany({});
    }

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i] as Record<string, unknown>;
      const partNumberA = (row.partNumberA ?? row.part_number_a ?? '').toString().trim();
      const partNumberB = (row.partNumberB ?? row.part_number_b ?? '').toString().trim();
      const manufactureName = (row.manufactureName ?? row.manufacture_name ?? '').toString().trim();
      const wagoCrossA = (row.wagoCrossA ?? row.wago_cross_a ?? '').toString().trim();
      const wagoCrossB = (row.wagoCrossB ?? row.wago_cross_b ?? '').toString().trim();

      const originalPartNumber = partNumberA || partNumberB;
      if (!originalPartNumber || !manufactureName) {
        errors.push(`Row ${i + 1}: PartNumberA or PartNumberB and ManufactureName are required`);
        continue;
      }
      if (!wagoCrossA && !wagoCrossB) {
        errors.push(`Row ${i + 1}: At least one of WAGOCrossA or WAGOCrossB is required`);
        await prisma.failureReport.create({
          data: {
            source: 'CROSS_REF_IMPORT',
            failureType: 'NO_WAGO_CROSS',
            importBatchId,
            context: { rowIndex: i + 1, partNumberA, partNumberB, manufactureName },
            message: `Row ${i + 1}: At least one of WAGOCrossA or WAGOCrossB is required`,
            userId
          }
        });
        continue;
      }

      const wagoPartNumbers = [wagoCrossA, wagoCrossB].filter(Boolean);
      for (const wagoPn of wagoPartNumbers) {
        const wagoPart = await prisma.part.findFirst({
          where: { partNumber: wagoPn },
          select: { id: true }
        });
        if (!wagoPart) {
          errors.push(`Row ${i + 1}: WAGO part not found: ${wagoPn}`);
          await prisma.failureReport.create({
            data: {
              source: 'CROSS_REF_IMPORT',
              failureType: 'WAGO_PART_NOT_FOUND',
              importBatchId,
              context: { rowIndex: i + 1, manufactureName, originalPartNumber, wagoPartNumber: wagoPn },
              message: `Row ${i + 1}: WAGO part not found: ${wagoPn}`,
              userId
            }
          });
          continue;
        }

        const notesA = (row.notesA ?? row.notes_a ?? '').toString().trim() || null;
        const notesB = (row.notesB ?? row.notes_b ?? '').toString().trim() || null;
        const notes = notesA || notesB || null;
        const activeItem = parseOptionalBoolean(row.activeItem ?? row.active_item);
        const estimatedPrice = parseOptionalDecimal(row.estimatedPrice ?? row.estimated_price);
        const author = (row.author ?? '').toString().trim() || null;
        const lastDateModified = parseOptionalDate(row.lastDateModified ?? row.last_date_modified);

        const data = {
          originalManufacturer: manufactureName,
          originalPartNumber,
          wagoPartId: wagoPart.id,
          compatibilityScore: 1.0,
          notes,
          partNumberA: partNumberA || null,
          partNumberB: partNumberB || null,
          manufactureName: manufactureName || null,
          activeItem,
          estimatedPrice: estimatedPrice != null ? estimatedPrice : undefined,
          wagoCrossA: wagoCrossA || null,
          wagoCrossB: wagoCrossB || null,
          notesA,
          notesB,
          author,
          lastDateModified,
          importBatchId,
          createdById: userId,
          sourceFilename: null
        };

        try {
          if (replace) {
            await prisma.crossReference.create({ data });
            created++;
          } else {
            const existing = await prisma.crossReference.findUnique({
              where: {
                originalManufacturer_originalPartNumber_wagoPartId: {
                  originalManufacturer: manufactureName,
                  originalPartNumber,
                  wagoPartId: wagoPart.id
                }
              }
            });
            if (existing) {
              await prisma.crossReference.update({
                where: { id: existing.id },
                data: {
                  notes: data.notes,
                  partNumberA: data.partNumberA,
                  partNumberB: data.partNumberB,
                  manufactureName: data.manufactureName,
                  activeItem: data.activeItem,
                  estimatedPrice: data.estimatedPrice,
                  wagoCrossA: data.wagoCrossA,
                  wagoCrossB: data.wagoCrossB,
                  notesA: data.notesA,
                  notesB: data.notesB,
                  author: data.author,
                  lastDateModified: data.lastDateModified,
                  importBatchId: data.importBatchId,
                  createdById: data.createdById
                }
              });
              updated++;
            } else {
              await prisma.crossReference.create({ data });
              created++;
            }
          }
        } catch (e) {
          errors.push(`Row ${i + 1} (${manufactureName}/${originalPartNumber}/${wagoPn}): ${(e as Error).message}`);
        }
      }
    }

    res.json({
      created,
      updated,
      totalRows: rawRows.length,
      errors: errors.length ? errors : undefined,
      importBatchId
    });
  } catch (error) {
    console.error('Import cross-references (master) error:', error);
    res.status(500).json({ error: 'Failed to import cross-references' });
  }
};

// ---------------------------------------------------------------------------
// Failure Report (ADMIN)
// ---------------------------------------------------------------------------

export const getFailureReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { source, resolved, fromDate, toDate, limit = '100', offset = '0' } = req.query;
    const where: any = {};
    if (source && typeof source === 'string') where.source = source;
    if (resolved === 'true') where.resolvedAt = { not: null };
    else if (resolved === 'false') where.resolvedAt = null;
    if (fromDate && typeof fromDate === 'string') {
      where.createdAt = { ...where.createdAt, gte: new Date(fromDate) };
    }
    if (toDate && typeof toDate === 'string') {
      where.createdAt = { ...where.createdAt, lte: new Date(toDate) };
    }
    const take = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100));
    const skip = Math.max(0, parseInt(String(offset), 10) || 0);

    const [reports, total] = await Promise.all([
      prisma.failureReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          resolvedBy: { select: { id: true, email: true, firstName: true, lastName: true } }
        }
      }),
      prisma.failureReport.count({ where })
    ]);

    res.json({ reports, total, limit: take, offset: skip });
  } catch (error) {
    console.error('Get failure reports error:', error);
    res.status(500).json({ error: 'Failed to fetch failure reports' });
  }
};

export const resolveFailureReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { resolutionNote } = req.body;
    if (!resolutionNote || typeof resolutionNote !== 'string' || !resolutionNote.trim()) {
      res.status(400).json({ error: 'resolutionNote is required' });
      return;
    }

    const report = await prisma.failureReport.findUnique({ where: { id } });
    if (!report) {
      res.status(404).json({ error: 'Failure report not found' });
      return;
    }
    if (report.resolvedAt) {
      res.status(400).json({ error: 'Already resolved' });
      return;
    }

    const updated = await prisma.failureReport.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolvedById: req.user!.id,
        resolutionNote: resolutionNote.trim()
      },
      include: {
        resolvedBy: { select: { id: true, email: true, firstName: true, lastName: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Resolve failure report error:', error);
    res.status(500).json({ error: 'Failed to resolve failure report' });
  }
};
