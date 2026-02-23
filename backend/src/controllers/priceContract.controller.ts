import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { isInternal } from '../lib/roles';
import { parseWagoPDF } from '../lib/pdfParser';
import { quoteFieldsFromNumber, parseMoqToMinQuantity, parseMetadataDate } from '../lib/quoteNumber';
import * as fs from 'fs/promises';
import archiver from 'archiver';

/**
 * GET /api/price-contracts – list contracts (ADMIN/RSM only, or assignees see assigned)
 * Query: view=by-quote → returns { view, groups, ungrouped }; otherwise flat array.
 */
export const list = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const role = req.user.role;
    const view = (req.query.view as string) || '';

    const include = {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { items: true, userAssignments: true } },
    };

    let contracts: Awaited<ReturnType<typeof prisma.priceContract.findMany>>;
    if (isInternal(role)) {
      contracts = await prisma.priceContract.findMany({
        include,
        orderBy: { name: 'asc' },
      });
    } else {
      const assigned = await prisma.userPriceContractAssignment.findMany({
        where: { userId: req.user.id },
        include: {
          contract: {
            include: { _count: { select: { items: true } } },
          },
        },
      });
      contracts = assigned.map((a) => a.contract) as typeof contracts;
    }

    if (view === 'by-quote') {
      const groups: Array<{ quoteKey: string; quoteCore: string | null; quoteYear: string | null; contracts: typeof contracts }> = [];
      const ungrouped: typeof contracts = [];
      const seen = new Map<string, number>();
      for (const c of contracts) {
        const core = c.quoteCore ?? '';
        const year = c.quoteYear ?? '';
        const key = [core, year].filter(Boolean).join('|') || '__ungrouped__';
        if (key === '__ungrouped__') {
          ungrouped.push(c);
          continue;
        }
        const idx = seen.get(key);
        if (idx === undefined) {
          const group = { quoteKey: key, quoteCore: c.quoteCore, quoteYear: c.quoteYear, contracts: [c] };
          groups.push(group);
          seen.set(key, groups.length - 1);
        } else {
          groups[idx].contracts.push(c);
        }
      }
      for (const g of groups) {
        g.contracts.sort((a, b) => a.name.localeCompare(b.name));
      }
      groups.sort((a, b) => (a.quoteKey || '').localeCompare(b.quoteKey || ''));
      res.json({ view: 'by-quote', groups, ungrouped });
      return;
    }

    res.json(contracts);
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

    const { name, description, validFrom, validTo, quoteNumber } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const quote = quoteNumber != null && String(quoteNumber).trim()
      ? quoteFieldsFromNumber(String(quoteNumber).trim())
      : { quoteCore: null, quoteYear: null, quotePrefix: null, quoteRevision: null };

    const contract = await prisma.priceContract.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        quoteNumber: quoteNumber != null && String(quoteNumber).trim() ? String(quoteNumber).trim() : null,
        quoteCore: quote.quoteCore,
        quoteYear: quote.quoteYear,
        quotePrefix: quote.quotePrefix,
        quoteRevision: quote.quoteRevision,
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
        items: {
          include: {
            part: { select: { id: true, partNumber: true, series: true, description: true, basePrice: true } },
            category: { select: { id: true, name: true } },
          },
        },
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
    const { name, description, validFrom, validTo, quoteNumber } = req.body;
    const updateData: Record<string, unknown> = {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(description !== undefined && { description: description ? String(description).trim() : null }),
      ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
      ...(validTo !== undefined && { validTo: validTo ? new Date(validTo) : null }),
    };
    if (quoteNumber !== undefined) {
      const raw = quoteNumber == null || quoteNumber === '' ? null : String(quoteNumber).trim();
      updateData.quoteNumber = raw;
      if (raw) {
        const quote = quoteFieldsFromNumber(raw);
        updateData.quoteCore = quote.quoteCore;
        updateData.quoteYear = quote.quoteYear;
        updateData.quotePrefix = quote.quotePrefix;
        updateData.quoteRevision = quote.quoteRevision;
      } else {
        updateData.quoteCore = null;
        updateData.quoteYear = null;
        updateData.quotePrefix = null;
        updateData.quoteRevision = null;
      }
    }
    const contract = await prisma.priceContract.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.priceContract.update>[0]['data'],
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
      const moqRaw = row.moq != null ? String(row.moq).trim() : null;
      const minQuantity = moqRaw ? parseMoqToMinQuantity(moqRaw) : Math.max(1, parseInt(String(row.minQuantity), 10) || 1);
      if (isNaN(costPrice)) continue;
      const item = await prisma.priceContractItem.create({
        data: {
          contractId,
          partId,
          seriesOrGroup,
          costPrice,
          suggestedSellPrice,
          discountPercent,
          moq: moqRaw || null,
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
        // Determine if this is a series discount or product
        const isSeriesDiscount = !row.partNumber && row.series;

        // Extract price (series discounts use 0; products require a valid price)
        const priceStr = row.price.replace(/[$,]/g, '').trim();
        const costPrice = priceStr ? parseFloat(priceStr) : 0;
        if (!isSeriesDiscount && isNaN(costPrice)) {
          skipped.push({ row, reason: 'Invalid price' });
          continue;
        }
        const finalCostPrice = isSeriesDiscount ? 0 : costPrice;

        // Extract discount if present
        const discountStr = row.discount.replace(/%/g, '').trim();
        const discountPercent = discountStr ? parseFloat(discountStr) : null;

        // For products: try to find matching part by part number
        let partId: string | null = null;
        if (row.partNumber && !isSeriesDiscount) {
          const part = await prisma.part.findFirst({
            where: { partNumber: row.partNumber },
            select: { id: true },
          });
          partId = part?.id || null;
        }

        // For series discounts: try to match series to a category (by category name = series number)
        let categoryId: string | null = null;
        if (isSeriesDiscount && row.series) {
          const category = await prisma.category.findFirst({
            where: {
              OR: [
                { name: row.series },
                { name: { contains: row.series, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          });
          categoryId = category?.id || null;
        }

        const moqStr = (row.moq && String(row.moq).trim()) || null;
        const minQty = moqStr ? parseMoqToMinQuantity(moqStr) : 1;

        // Create item (store partNumber so we can display it when no matching Part in catalog)
        const item = await prisma.priceContractItem.create({
          data: {
            contractId,
            partId,
            partNumber: !isSeriesDiscount && row.partNumber ? row.partNumber : null,
            categoryId,
            seriesOrGroup: isSeriesDiscount ? row.series : (row.series || null),
            costPrice: finalCostPrice,
            suggestedSellPrice: null, // User can fill this in later
            discountPercent: discountPercent,
            moq: moqStr,
            minQuantity: minQty,
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

    // Update contract with PDF metadata (quote number, dates)
    const meta = parseResult.metadata || {};
    const contractUpdate: Record<string, unknown> = {};
    if (meta.quoteNumber && String(meta.quoteNumber).trim()) {
      const q = quoteFieldsFromNumber(String(meta.quoteNumber).trim());
      contractUpdate.quoteNumber = meta.quoteNumber.trim();
      contractUpdate.quoteCore = q.quoteCore;
      contractUpdate.quoteYear = q.quoteYear;
      contractUpdate.quotePrefix = q.quotePrefix;
      contractUpdate.quoteRevision = q.quoteRevision;
    }
    const validFromDate = parseMetadataDate(meta.quoteDate);
    if (validFromDate) contractUpdate.validFrom = validFromDate;
    const validToDate = parseMetadataDate(meta.expirationDate);
    if (validToDate) contractUpdate.validTo = validToDate;
    if (Object.keys(contractUpdate).length > 0) {
      await prisma.priceContract.update({
        where: { id: contractId },
        data: contractUpdate as Parameters<typeof prisma.priceContract.update>[0]['data'],
      });
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

/**
 * PATCH /api/price-contracts/:id/items/:itemId – update item (ADMIN/RSM only)
 * Body: { partNumber?, costPrice?, moq?, minQuantity?, suggestedSellPrice? }. If partNumber provided, looks up Part and sets partId.
 */
export const updateItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }
    const { id: contractId, itemId } = req.params;
    const { partNumber: bodyPartNumber, costPrice: bodyCostPrice, moq: bodyMoq, minQuantity: bodyMinQty, suggestedSellPrice: bodySuggestedSell } = req.body;

    const contract = await prisma.priceContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    const existing = await prisma.priceContractItem.findFirst({
      where: { id: itemId, contractId },
      include: { part: { select: { id: true, partNumber: true, basePrice: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const partNumber = typeof bodyPartNumber === 'string' && bodyPartNumber.trim() ? bodyPartNumber.trim() : existing.partNumber;
    const costPrice = typeof bodyCostPrice === 'number' && bodyCostPrice >= 0 ? bodyCostPrice : existing.costPrice;

    let partId: string | null = null;
    if (partNumber) {
      const part = await prisma.part.findFirst({
        where: { partNumber },
        select: { id: true },
      });
      partId = part?.id || null;
    }

    const data: Record<string, unknown> = {
      partNumber: partNumber || null,
      costPrice,
      partId,
    };
    if (bodyMoq !== undefined) {
      data.moq = bodyMoq == null || bodyMoq === '' ? null : String(bodyMoq).trim();
      data.minQuantity = parseMoqToMinQuantity(bodyMoq);
    }
    if (bodyMinQty !== undefined && bodyMoq === undefined) {
      const n = Math.max(1, parseInt(String(bodyMinQty), 10) || 1);
      data.minQuantity = n;
    }
    if (bodySuggestedSell !== undefined) {
      data.suggestedSellPrice = bodySuggestedSell === null || bodySuggestedSell === '' ? null : (typeof bodySuggestedSell === 'number' ? bodySuggestedSell : parseFloat(String(bodySuggestedSell)));
      if (typeof data.suggestedSellPrice === 'number' && (Number.isNaN(data.suggestedSellPrice) || data.suggestedSellPrice < 0)) {
        data.suggestedSellPrice = null;
      }
    }

    const updated = await prisma.priceContractItem.update({
      where: { id: itemId },
      data: data as Parameters<typeof prisma.priceContractItem.update>[0]['data'],
      include: { part: { select: { id: true, partNumber: true, series: true, description: true, basePrice: true } }, category: { select: { id: true, name: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update contract item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
};

/**
 * DELETE /api/price-contracts/:id/items/:itemId – remove item from contract (ADMIN/RSM only)
 */
export const removeItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }
    const { id: contractId, itemId } = req.params;

    const contract = await prisma.priceContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    const item = await prisma.priceContractItem.findFirst({
      where: { id: itemId, contractId },
    });
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    await prisma.priceContractItem.delete({ where: { id: itemId } });
    res.status(204).send();
  } catch (error) {
    console.error('Remove contract item error:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
};

/**
 * POST /api/price-contracts/:id/items/bulk-sell-price – set suggested sell for selected items (ADMIN/RSM only)
 * Body: { itemIds: string[], marginPercent?: number, suggestedSellPrice?: number }
 */
export const bulkApplySellPrice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }
    const { id: contractId } = req.params;
    const { itemIds, marginPercent, suggestedSellPrice } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: 'itemIds array required' });
      return;
    }
    const contract = await prisma.priceContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const ids = itemIds.filter((x: unknown) => typeof x === 'string') as string[];
    const items = await prisma.priceContractItem.findMany({
      where: { id: { in: ids }, contractId },
      select: { id: true, costPrice: true },
    });
    const fixedPrice = typeof suggestedSellPrice === 'number' && suggestedSellPrice >= 0 ? suggestedSellPrice : null;
    const margin = typeof marginPercent === 'number' && !Number.isNaN(marginPercent) ? marginPercent / 100 : null;
    for (const item of items) {
      const price = fixedPrice != null
        ? fixedPrice
        : margin != null && margin < 1
          ? item.costPrice / (1 - margin)
          : null;
      await prisma.priceContractItem.update({
        where: { id: item.id },
        data: { suggestedSellPrice: price },
      });
    }
    const updated = await prisma.priceContract.findUnique({
      where: { id: contractId },
      include: { items: { include: { part: { select: { partNumber: true, series: true } } } } },
    });
    res.json(updated);
  } catch (error) {
    console.error('Bulk apply sell price error:', error);
    res.status(500).json({ error: 'Failed to apply sell price' });
  }
};

/**
 * POST /api/price-contracts/:id/items/bulk-moq – set MOQ for selected items (ADMIN/RSM only)
 * Body: { itemIds: string[], moq: string }
 */
export const bulkApplyMoq = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }
    const { id: contractId } = req.params;
    const { itemIds, moq } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: 'itemIds array required' });
      return;
    }
    if (moq == null || typeof moq !== 'string') {
      res.status(400).json({ error: 'moq string required' });
      return;
    }
    const contract = await prisma.priceContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const ids = itemIds.filter((x: unknown) => typeof x === 'string') as string[];
    const moqStr = moq.trim();
    const minQty = parseMoqToMinQuantity(moqStr);
    await prisma.priceContractItem.updateMany({
      where: { id: { in: ids }, contractId },
      data: { moq: moqStr || null, minQuantity: minQty },
    });
    const updated = await prisma.priceContract.findUnique({
      where: { id: contractId },
      include: { items: { include: { part: { select: { partNumber: true, series: true } } } } },
    });
    res.json(updated);
  } catch (error) {
    console.error('Bulk apply MOQ error:', error);
    res.status(500).json({ error: 'Failed to apply MOQ' });
  }
};

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * GET /api/price-contracts/:id/download-csv – download contract as CSV (ADMIN/RSM or assignee)
 */
export const downloadCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;
    const contract = await prisma.priceContract.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: { select: { partNumber: true, series: true, description: true } },
            category: { select: { name: true } },
          },
        },
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
    const headers = ['Part Number', 'Series', 'Description', 'Cost', 'Min Qty / MOQ', 'Suggested Sell', 'Discount %'];
    const rows = [headers.map(escapeCsvCell).join(',')];
    for (const item of contract.items) {
      const partNum = item.partNumber ?? item.part?.partNumber ?? item.seriesOrGroup ?? '';
      const series = item.seriesOrGroup ?? item.part?.series ?? '';
      const desc = item.part?.description ?? (item.category ? `Series ${item.category.name} discount` : '');
      const moqDisplay = item.moq ?? String(item.minQuantity);
      rows.push([
        escapeCsvCell(partNum),
        escapeCsvCell(series),
        escapeCsvCell(desc),
        escapeCsvCell(item.costPrice),
        escapeCsvCell(moqDisplay),
        escapeCsvCell(item.suggestedSellPrice),
        escapeCsvCell(item.discountPercent),
      ].join(','));
    }
    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="price-contract-${contract.name.replace(/[^a-zA-Z0-9_-]/g, '-')}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Download contract CSV error:', error);
    res.status(500).json({ error: 'Failed to download CSV' });
  }
};

/**
 * GET /api/price-contracts/:id/download-quote-family – ZIP of CSVs for contracts in same quote family (ADMIN/RSM or assignee)
 */
export const downloadQuoteFamilyZip = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;
    const contract = await prisma.priceContract.findUnique({
      where: { id },
      select: { id: true, name: true, quoteCore: true, quoteYear: true },
    });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    if (!contract.quoteCore) {
      res.status(400).json({ error: 'Contract has no quote number; cannot build quote family' });
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
    const family = await prisma.priceContract.findMany({
      where: {
        quoteCore: contract.quoteCore,
        ...(contract.quoteYear != null && contract.quoteYear !== '' ? { quoteYear: contract.quoteYear } : {}),
      },
      include: {
        items: {
          include: {
            part: { select: { partNumber: true, series: true, description: true } },
            category: { select: { name: true } },
          },
        },
      },
    });
    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="quote-family-${contract.quoteCore}-${contract.quoteYear || 'all'}.zip"`);
    archive.pipe(res);
    const headers = ['Part Number', 'Series', 'Description', 'Cost', 'Min Qty / MOQ', 'Suggested Sell', 'Discount %'];
    for (const c of family) {
      const rows = [headers.map(escapeCsvCell).join(',')];
      for (const item of c.items) {
        const partNum = item.partNumber ?? item.part?.partNumber ?? item.seriesOrGroup ?? '';
        const series = item.seriesOrGroup ?? item.part?.series ?? '';
        const desc = item.part?.description ?? (item.category ? `Series ${item.category.name} discount` : '');
        const moqDisplay = item.moq ?? String(item.minQuantity);
        rows.push([
          escapeCsvCell(partNum),
          escapeCsvCell(series),
          escapeCsvCell(desc),
          escapeCsvCell(item.costPrice),
          escapeCsvCell(moqDisplay),
          escapeCsvCell(item.suggestedSellPrice),
          escapeCsvCell(item.discountPercent),
        ].join(','));
      }
      const csv = '\uFEFF' + rows.join('\r\n');
      const safeName = c.name.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.csv';
      archive.append(csv, { name: safeName });
    }
    await archive.finalize();
  } catch (error) {
    console.error('Download quote family ZIP error:', error);
    res.status(500).json({ error: 'Failed to download quote family' });
  }
};
