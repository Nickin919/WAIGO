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

    let created = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const wagoPart = await prisma.part.findFirst({
        where: { partNumber: row.wagoPartNumber.trim() },
        select: { id: true }
      });
      if (!wagoPart) {
        errors.push(`WAGO part not found: ${row.wagoPartNumber}`);
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
      errors: errors.length ? errors : undefined
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
