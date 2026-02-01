import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import Papa from 'papaparse';
import fs from 'fs';
import { parseWagoPDF } from '../lib/pdfParser';

/**
 * Get cost tables accessible to user
 */
export const getCostTables = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['TURNKEY', 'DISTRIBUTOR', 'RSM', 'ADMIN'].includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    let where: any = {};

    if (req.user.role === 'TURNKEY') {
      // TurnKey users see their own and their team's tables
      where.OR = [
        { userId: req.user.id },
        ...(req.user.turnkeyTeamId ? [{ turnkeyTeamId: req.user.turnkeyTeamId }] : [])
      ];
    } else if (req.user.role === 'DISTRIBUTOR') {
      // Distributors see tables of their assigned users
      where.user = {
        assignedToDistributorId: req.user.id
      };
    }
    // RSM and ADMIN see all (no where clause)

    const costTables = await prisma.costTable.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            assignedToDistributorId: true
          }
        },
        turnkeyTeam: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(costTables);
  } catch (error) {
    console.error('Get cost tables error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing contracts' });
  }
};

/**
 * Get cost table by ID with items
 */
export const getCostTableById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const costTable = await prisma.costTable.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            assignedToDistributorId: true
          }
        },
        turnkeyTeam: {
          select: {
            id: true,
            name: true
          }
        },
        items: {
          orderBy: { partNumber: 'asc' }
        }
      }
    });

    if (!costTable) {
      res.status(404).json({ error: 'Pricing contract not found' });
      return;
    }

    // Check access permissions
    const hasAccess = 
      req.user.role === 'ADMIN' ||
      req.user.role === 'RSM' ||
      costTable.userId === req.user.id ||
      (costTable.turnkeyTeamId && costTable.turnkeyTeamId === req.user.turnkeyTeamId) ||
      (req.user.role === 'DISTRIBUTOR' && costTable.user?.assignedToDistributorId === req.user.id);

    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(costTable);
  } catch (error) {
    console.error('Get cost table error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing contract' });
  }
};

/**
 * Create cost table
 */
export const createCostTable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['TURNKEY', 'DISTRIBUTOR', 'RSM', 'ADMIN'].includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { name, description, isTeamTable } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const data: any = {
      name,
      description
    };

    // Determine ownership
    if (isTeamTable && req.user.turnkeyTeamId) {
      data.turnkeyTeamId = req.user.turnkeyTeamId;
    } else {
      data.userId = req.user.id;
    }

    const costTable = await prisma.costTable.create({
      data,
      include: {
        items: true
      }
    });

    res.status(201).json(costTable);
  } catch (error) {
    console.error('Create cost table error:', error);
    res.status(500).json({ error: 'Failed to create pricing contract' });
  }
};

/**
 * Upload cost table from CSV
 */
export const uploadCostTableCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.file) {
      res.status(400).json({ error: 'File required' });
      return;
    }

    const { costTableId } = req.body;

    if (!costTableId) {
      res.status(400).json({ error: 'costTableId required' });
      return;
    }

    // Verify ownership
    const costTable = await prisma.costTable.findUnique({
      where: { id: costTableId },
      select: { userId: true, turnkeyTeamId: true }
    });

    if (!costTable) {
      res.status(404).json({ error: 'Pricing contract not found' });
      return;
    }

    const hasAccess = 
      costTable.userId === req.user.id ||
      (costTable.turnkeyTeamId && costTable.turnkeyTeamId === req.user.turnkeyTeamId) ||
      ['ADMIN', 'RSM'].includes(req.user.role);

    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Parse CSV
    const csvContent = fs.readFileSync(req.file.path, 'utf-8');
    const parsed = Papa.parse(csvContent, { 
      header: true,
      skipEmptyLines: true
    });

    // Expected columns: Part Number, Description, Custom Cost, Notes
    const items = parsed.data.map((row: any) => ({
      partNumber: row['Part Number'] || row['part_number'],
      description: row['Description'] || row['description'],
      customCost: parseFloat(row['Custom Cost'] || row['custom_cost'] || '0'),
      notes: row['Notes'] || row['notes']
    })).filter(item => item.partNumber);

    // Delete existing items and create new ones (transactional)
    await prisma.$transaction([
      prisma.costTableItem.deleteMany({
        where: { costTableId }
      }),
      prisma.costTableItem.createMany({
        data: items.map(item => ({
          ...item,
          costTableId
        }))
      })
    ]);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ 
      message: 'Pricing contract updated successfully',
      itemsImported: items.length
    });
  } catch (error) {
    console.error('Upload CSV error:', error);
    res.status(500).json({ error: 'Failed to upload pricing contract' });
  }
};

/**
 * Download cost table as CSV
 */
export const downloadCostTableCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const costTable = await prisma.costTable.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { partNumber: 'asc' }
        }
      }
    });

    if (!costTable) {
      res.status(404).json({ error: 'Pricing contract not found' });
      return;
    }

    // Generate CSV
    const csvData = costTable.items.map(item => ({
      'Part Number': item.partNumber,
      'Description': item.description || '',
      'Custom Cost': item.customCost,
      'Notes': item.notes || ''
    }));

    const csv = Papa.unparse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pricing-contract-${costTable.name}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Download CSV error:', error);
    res.status(500).json({ error: 'Failed to download pricing contract' });
  }
};

/**
 * Update cost table
 */
export const updateCostTable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const costTable = await prisma.costTable.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(costTable);
  } catch (error) {
    console.error('Update cost table error:', error);
    res.status(500).json({ error: 'Failed to update pricing contract' });
  }
};

/**
 * Delete cost table
 */
export const deleteCostTable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    await prisma.costTable.delete({
      where: { id }
    });

    res.json({ message: 'Pricing contract deleted successfully' });
  } catch (error) {
    console.error('Delete cost table error:', error);
    res.status(500).json({ error: 'Failed to delete pricing contract' });
  }
};

/**
 * Get custom cost for part (checks user's cost tables)
 */
export const getPartCustomCost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'FREE') {
      res.status(403).json({ error: 'Login required' });
      return;
    }

    const { partNumber } = req.params;

    // Find applicable cost tables
    const costTables = await prisma.costTable.findMany({
      where: {
        isActive: true,
        OR: [
          { userId: req.user.id },
          ...(req.user.turnkeyTeamId ? [{ turnkeyTeamId: req.user.turnkeyTeamId }] : [])
        ]
      },
      include: {
        items: {
          where: { partNumber }
        }
      }
    });

    // Find first matching item
    const customCostItem = costTables
      .flatMap(table => table.items)
      .find(item => item.partNumber === partNumber);

    if (customCostItem) {
      res.json({
        partNumber,
        customCost: customCostItem.customCost,
        description: customCostItem.description,
        notes: customCostItem.notes
      });
    } else {
      res.status(404).json({ error: 'No custom cost found for this part' });
    }
  } catch (error) {
    console.error('Get custom cost error:', error);
    res.status(500).json({ error: 'Failed to fetch custom cost' });
  }
};

/**
 * Upload PDF and parse into cost table items
 * POST /api/cost-tables/:id/upload-pdf
 * 
 * Uses native TypeScript PDF parser with:
 * - Multi-page table continuity
 * - MOQ extraction
 * - Series discount auto-application
 * - Net price calculation
 * - Validation warnings
 */
export const uploadPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['TURNKEY', 'DISTRIBUTOR', 'RSM', 'ADMIN'].includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { id: costTableId } = req.params;
    const costTable = await prisma.costTable.findUnique({ where: { id: costTableId } });
    if (!costTable) {
      res.status(404).json({ error: 'Pricing contract not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'PDF file required' });
      return;
    }

    const pdfPath = req.file.path;

    // Parse PDF using native TypeScript parser
    const parseResult = await parseWagoPDF(pdfPath);

    // Clean up uploaded PDF
    try {
      fs.unlinkSync(pdfPath);
    } catch {
      // Ignore cleanup errors
    }

    if (!parseResult.success || parseResult.rows.length === 0) {
      res.status(400).json({
        error: 'Failed to parse PDF or no valid rows found',
        details: parseResult.errors,
        unparsedRows: parseResult.unparsedRows,
        warnings: parseResult.warnings,
      });
      return;
    }

    // Import parsed rows as cost table items
    const imported: Array<{
      partNumber: string;
      description: string;
      customCost: number;
      netPrice: number | null;
      moq: string;
      discount: string;
    }> = [];
    const skipped: Array<{ partNumber: string; reason: string }> = [];

    for (const row of parseResult.rows) {
      try {
        // Skip series discount rows (no part number, just discount %)
        if (!row.partNumber && row.discount) {
          skipped.push({ 
            partNumber: `Series ${row.series}`, 
            reason: `Series discount (${row.discount}) - applied to matching parts` 
          });
          continue;
        }

        // Extract price (remove $ and commas)
        const priceStr = row.price.replace(/[$,]/g, '').trim();
        const customCost = parseFloat(priceStr);

        if (isNaN(customCost) || customCost <= 0) {
          skipped.push({ partNumber: row.partNumber || row.series, reason: 'Invalid or zero price' });
          continue;
        }

        const partNumber = row.partNumber || row.series;
        if (!partNumber) {
          skipped.push({ partNumber: '(empty)', reason: 'No part number' });
          continue;
        }

        // Extract net price if available
        const netPriceStr = row.netPrice?.replace(/[$,]/g, '').trim();
        const netPrice = netPriceStr ? parseFloat(netPriceStr) : null;

        // Build notes with MOQ and discount info
        const notesParts: string[] = ['Imported from PDF'];
        if (row.discount) notesParts.push(`Discount: ${row.discount}`);
        if (row.moq) notesParts.push(`MOQ: ${row.moq}`);
        if (netPrice && netPrice !== customCost) notesParts.push(`Net: $${netPrice.toFixed(2)}`);
        const notes = notesParts.join(' | ');

        // Upsert item (update if exists, create if not)
        await prisma.costTableItem.upsert({
          where: {
            costTableId_partNumber: { costTableId, partNumber }
          },
          create: {
            costTableId,
            partNumber,
            description: row.description || '',
            customCost: netPrice || customCost, // Use net price if available
            notes,
          },
          update: {
            description: row.description || undefined,
            customCost: netPrice || customCost,
            notes,
          },
        });

        imported.push({ 
          partNumber, 
          description: row.description, 
          customCost,
          netPrice,
          moq: row.moq,
          discount: row.discount,
        });
      } catch (err: any) {
        skipped.push({ partNumber: row.partNumber || '?', reason: err.message || 'Database error' });
      }
    }

    // Update item count
    const itemCount = await prisma.costTableItem.count({ where: { costTableId } });

    res.status(201).json({
      success: true,
      itemsImported: imported.length,
      itemsSkipped: skipped.length,
      unparsedRows: parseResult.unparsedRows.length,
      totalItems: itemCount,
      imported,
      skipped,
      unparsedRowDetails: parseResult.unparsedRows,
      seriesDiscounts: parseResult.seriesDiscounts,
      warnings: parseResult.warnings,
      metadata: parseResult.metadata,
      stats: parseResult.stats,
    });
  } catch (error) {
    console.error('Upload PDF error:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
};
