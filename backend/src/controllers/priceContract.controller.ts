import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getSubordinateUserIds } from '../lib/hierarchy';
import { isInternal } from '../lib/roles';
import { parseWagoPDF } from '../lib/pdfParser';
import * as fs from 'fs/promises';

/**
 * GET /api/price-contracts – list contracts (ADMIN/RSM only, or assignees see assigned)
 */
export const list = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const role = req.user.role;

    if (isInternal(role)) {
      const contracts = await prisma.priceContract.findMany({
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { items: true, userAssignments: true } },
        },
        orderBy: { name: 'asc' },
      });
      res.json(contracts);
      return;
    }

    const assigned = await prisma.userPriceContractAssignment.findMany({
      where: { userId: req.user.id },
      include: {
        contract: {
          include: { _count: { select: { items: true } } },
        },
      },
    });
    res.json(assigned.map((a) => a.contract));
    return;
  } catch (error) {
    console.error('List price contracts error:', error);
    res.status(500).json({ error: 'Failed to list contracts' });
  }
};

/**
 * POST /api/price-contracts – create (ADMIN/RSM only)
 */
export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }

    const { name, description, validFrom, validTo } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const contract = await prisma.priceContract.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        createdById: req.user.id,
      },
    });
    res.status(201).json(contract);
  } catch (error) {
    console.error('Create price contract error:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
};

/**
 * GET /api/price-contracts/:id – get one with items
 */
export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;
    const contract = await prisma.priceContract.findUnique({
      where: { id },
      include: {
        items: { include: { part: { select: { id: true, partNumber: true, series: true, description: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    if (!isInternal(req.user.role)) {
      const assigned = await prisma.userPriceContractAssignment.findUnique({
        where: { userId_contractId: { userId: req.user.id, contractId: id } },
      });
      if (!assigned) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }
    res.json(contract);
  } catch (error) {
    console.error('Get price contract error:', error);
    res.status(500).json({ error: 'Failed to load contract' });
  }
};

/**
 * PATCH /api/price-contracts/:id – update (ADMIN/RSM only)
 */
export const update = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }
    const { id } = req.params;
    const { name, description, validFrom, validTo } = req.body;
    const contract = await prisma.priceContract.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
        ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
        ...(validTo !== undefined && { validTo: validTo ? new Date(validTo) : null }),
      },
    });
    res.json(contract);
  } catch (error) {
    console.error('Update price contract error:', error);
    res.status(500).json({ error: 'Failed to update contract' });
  }
};

/**
 * DELETE /api/price-contracts/:id – delete (ADMIN/RSM only)
 */
export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }
    const { id } = req.params;
    await prisma.priceContract.delete({ where: { id } });
    res.json({ message: 'Contract deleted' });
  } catch (error) {
    console.error('Delete price contract error:', error);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
};

/**
 * PATCH /api/my/contracts/:contractId/items – assignee updates only suggestedSellPrice
 * Body: { items: [{ id: string, suggestedSellPrice: number | null }] }
 */
export const updateMyContractItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { contractId } = req.params;
    const assigned = await prisma.userPriceContractAssignment.findUnique({
      where: { userId_contractId: { userId: req.user.id, contractId } },
    });
    if (!assigned) {
      res.status(403).json({ error: 'Not assigned to this contract' });
      return;
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items array required' });
      return;
    }

    for (const row of items) {
      const itemId = row.id;
      const suggestedSellPrice = row.suggestedSellPrice === null || row.suggestedSellPrice === undefined ? null : Number(row.suggestedSellPrice);
      if (!itemId) continue;
      await prisma.priceContractItem.updateMany({
        where: { id: itemId, contractId },
        data: { suggestedSellPrice },
      });
    }

    const updated = await prisma.priceContract.findUnique({
      where: { id: contractId },
      include: { items: { include: { part: { select: { partNumber: true, series: true } } } } },
    });
    res.json(updated);
  } catch (error) {
    console.error('Update my contract items error:', error);
    res.status(500).json({ error: 'Failed to update items' });
  }
};

/**
 * POST /api/price-contracts/:id/items – add items (ADMIN/RSM only); CSV or JSON body
 */
export const addItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }
    const { id: contractId } = req.params;
    const contract = await prisma.priceContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array required' });
      return;
    }

    const created = [];
    for (const row of items) {
      const partId = row.partId || null;
      const seriesOrGroup = row.seriesOrGroup?.trim() || null;
      const costPrice = Number(row.costPrice);
      const suggestedSellPrice = row.suggestedSellPrice != null ? Number(row.suggestedSellPrice) : null;
      const discountPercent = row.discountPercent != null ? Number(row.discountPercent) : null;
      const minQuantity = Math.max(1, parseInt(String(row.minQuantity), 10) || 1);
      if (isNaN(costPrice)) continue;
      const item = await prisma.priceContractItem.create({
        data: {
          contractId,
          partId,
          seriesOrGroup,
          costPrice,
          suggestedSellPrice,
          discountPercent,
          minQuantity,
        },
      });
      created.push(item);
    }
    res.status(201).json({ created: created.length, items: created });
  } catch (error) {
    console.error('Add contract items error:', error);
    res.status(500).json({ error: 'Failed to add items' });
  }
};

/**
 * POST /api/price-contracts/:id/items/upload-pdf – upload PDF and parse (ADMIN/RSM only)
 * Parses WAGO quote PDF, imports items, returns unparsed rows for user review.
 */
export const uploadPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }
    const { id: contractId } = req.params;
    const contract = await prisma.priceContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'PDF file required' });
      return;
    }

    const pdfPath = req.file.path;

    // Parse PDF
    const parseResult = await parseWagoPDF(pdfPath);

    // Clean up uploaded PDF
    try {
      await fs.unlink(pdfPath);
    } catch {
      // Ignore cleanup errors
    }

    if (!parseResult.success || parseResult.rows.length === 0) {
      res.status(400).json({
        error: 'Failed to parse PDF or no valid rows found',
        details: parseResult.errors,
        unparsedRows: parseResult.unparsedRows,
      });
      return;
    }

    // Import parsed rows as contract items
    const created = [];
    const skipped = [];

    for (const row of parseResult.rows) {
      try {
        // Extract price (remove $ and commas)
        const priceStr = row.price.replace(/[$,]/g, '').trim();
        const costPrice = parseFloat(priceStr);

        if (isNaN(costPrice)) {
          skipped.push({ row, reason: 'Invalid price' });
          continue;
        }

        // Extract discount if present
        const discountStr = row.discount.replace(/%/g, '').trim();
        const discountPercent = discountStr ? parseFloat(discountStr) : null;

        // Determine if this is a series discount or product
        const isSeriesDiscount = !row.partNumber && row.series;

        // For products: try to find matching part by part number
        let partId: string | null = null;
        if (row.partNumber && !isSeriesDiscount) {
          const part = await prisma.part.findFirst({
            where: { partNumber: row.partNumber },
            select: { id: true },
          });
          partId = part?.id || null;
        }

        // Create item
        const item = await prisma.priceContractItem.create({
          data: {
            contractId,
            partId,
            seriesOrGroup: isSeriesDiscount ? row.series : (row.series || null),
            costPrice,
            suggestedSellPrice: null, // User can fill this in later
            discountPercent: discountPercent,
            minQuantity: 1,
          },
        });

        created.push({
          id: item.id,
          partNumber: row.partNumber,
          series: row.series,
          description: row.description,
          costPrice,
          discountPercent,
        });
      } catch (err: any) {
        skipped.push({ row, reason: err.message || 'Database error' });
      }
    }

    res.status(201).json({
      success: true,
      imported: created.length,
      skipped: skipped.length,
      unparsedRows: parseResult.unparsedRows.length,
      items: created,
      skippedItems: skipped,
      unparsedRowDetails: parseResult.unparsedRows,
      metadata: parseResult.metadata,
      parseDebug: parseResult.parseDebug,
    });
  } catch (error) {
    console.error('Upload PDF error:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
};
