import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { logUnmatchedEvent } from '../lib/unmatchedLogger';

export const lookupCrossReference = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { manufacturer, partNumber } = req.query;

    if (!manufacturer || !partNumber) {
      res.status(400).json({ error: 'manufacturer and partNumber are required' });
      return;
    }

    const crossRefs = await prisma.crossReference.findMany({
      where: {
        originalManufacturer: manufacturer as string,
        originalPartNumber: partNumber as string
      },
      include: {
        wagoPart: {
          include: {
            category: true
          }
        }
      },
      orderBy: { compatibilityScore: 'desc' }
    });

    if (crossRefs.length === 0) {
      logUnmatchedEvent(
        {
          source: 'CROSS_REF_LOOKUP',
          process: 'lookupCrossReference',
          eventType: 'CROSS_REF_NOT_FOUND',
          submittedValue: partNumber as string,
          submittedField: 'partNumber',
          submittedManufacturer: manufacturer as string,
          matchedAgainst: 'CrossReference'
        },
        { userId: req.user?.id ?? undefined }
      ).catch(() => {});
    }

    res.json(crossRefs);
  } catch (error) {
    console.error('Lookup cross-reference error:', error);
    res.status(500).json({ error: 'Failed to lookup cross-reference' });
  }
};

export const createCrossReference = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { originalManufacturer, originalPartNumber, wagoPartId, compatibilityScore, notes } = req.body;

    if (!originalManufacturer || !originalPartNumber || !wagoPartId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const crossRef = await prisma.crossReference.create({
      data: {
        originalManufacturer,
        originalPartNumber,
        wagoPartId,
        compatibilityScore: compatibilityScore || 1.0,
        notes
      }
    });

    res.status(201).json(crossRef);
  } catch (error) {
    console.error('Create cross-reference error:', error);
    res.status(500).json({ error: 'Failed to create cross-reference' });
  }
};

export const updateCrossReference = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const crossRef = await prisma.crossReference.update({
      where: { id },
      data: updateData
    });

    res.json(crossRef);
  } catch (error) {
    console.error('Update cross-reference error:', error);
    res.status(500).json({ error: 'Failed to update cross-reference' });
  }
};

export const deleteCrossReference = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.crossReference.delete({
      where: { id }
    });

    res.json({ message: 'Cross-reference deleted successfully' });
  } catch (error) {
    console.error('Delete cross-reference error:', error);
    res.status(500).json({ error: 'Failed to delete cross-reference' });
  }
};
