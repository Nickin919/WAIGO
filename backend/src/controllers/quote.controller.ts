import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { ROLE_MAX_DISCOUNT } from '../lib/quoteConstants';

/**
 * Get subordinate user IDs for hierarchical quote visibility
 */
async function getSubordinateUserIds(userId: string, userRole: string): Promise<string[]> {
  const ids = [userId];

  switch (userRole) {
    case 'ADMIN':
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      return allUsers.map((u) => u.id);
    case 'RSM':
      const distributors = await prisma.user.findMany({
        where: { assignedToRsmId: userId },
        select: { id: true },
      });
      const distIds = distributors.map((d) => d.id);
      const underDist = await prisma.user.findMany({
        where: { assignedToDistributorId: { in: distIds } },
        select: { id: true },
      });
      return [...ids, ...distIds, ...underDist.map((u) => u.id)];
    case 'DISTRIBUTOR':
      const assigned = await prisma.user.findMany({
        where: { assignedToDistributorId: userId },
        select: { id: true },
      });
      return [...ids, ...assigned.map((u) => u.id)];
    case 'TURNKEY':
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { turnkeyTeamId: true },
      });
      if (u?.turnkeyTeamId) {
        const team = await prisma.user.findMany({
          where: { turnkeyTeamId: u.turnkeyTeamId },
          select: { id: true },
        });
        return team.map((t) => t.id);
      }
      return ids;
    default:
      return ids;
  }
}

async function canAccessQuote(userId: string, userRole: string, quoteUserId: string): Promise<boolean> {
  const subordinateIds = await getSubordinateUserIds(userId, userRole);
  return subordinateIds.includes(quoteUserId);
}

/**
 * Get quotes (hierarchical visibility)
 */
export const getQuotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const subordinateIds = await getSubordinateUserIds(req.user.id, req.user.role);

    const quotes = await prisma.quote.findMany({
      where: { userId: { in: subordinateIds } },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        customer: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(quotes);
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
};

/**
 * Get quote by ID
 */
export const getQuoteById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        customer: true,
        items: {
          include: {
            part: {
              select: { id: true, thumbnailUrl: true },
            },
          },
        },
        discounts: true,
      },
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    const allowed = await canAccessQuote(req.user.id, req.user.role, quote.userId);
    if (!allowed) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(quote);
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
};

/**
 * Create quote with snapshot pricing and role-based discount validation
 */
export const createQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { catalogId, customerId, customerName, customerEmail, customerCompany, notes, items } = req.body;

    if (!catalogId) {
      res.status(400).json({ error: 'catalogId is required' });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    const maxDiscount = ROLE_MAX_DISCOUNT[req.user.role] ?? 10;
    for (const item of items) {
      const discount = Number(item.discountPct) || 0;
      if (discount > maxDiscount) {
        res.status(400).json({
          error: `Discount exceeds your maximum allowed (${maxDiscount}%)`,
        });
        return;
      }
    }

    let displayName = customerName || '';
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (customer) {
        displayName = customer.company ? `${customer.name} (${customer.company})` : customer.name;
      }
    }

    const count = await prisma.quote.count();
    const quoteNumber = `PP#${(count + 1).toString().padStart(6, '0')}`;

    let total = 0;
    const itemsToCreate: any[] = [];

    for (const item of items) {
      const part = await prisma.part.findUnique({
        where: { id: item.partId },
      });
      if (!part) {
        res.status(400).json({ error: `Part ${item.partId} not found` });
        return;
      }

      const listPrice = part.basePrice ?? 0;
      const discountPct = Number(item.discountPct) || 0;
      const marginPct = Number(item.marginPct) || 0;
      const quantity = Math.max(1, parseInt(String(item.quantity), 10) || 1);

      const costPrice = listPrice * (1 - discountPct / 100);
      const sellPrice = costPrice * (1 + marginPct / 100);
      const lineTotal = quantity * sellPrice;
      total += lineTotal;

      itemsToCreate.push({
        quoteId: '', // Set after quote created
        partId: part.id,
        partNumber: part.partNumber,
        description: part.englishDescription || part.description,
        quantity,
        packageQty: part.packageQty ?? 1,
        minQty: part.minQty ?? 1,
        discountPct,
        marginPct,
        costPrice,
        sellPrice,
        lineTotal,
        snapshotSeries: part.series || part.partNumber,
        snapshotPartNumber: part.partNumber,
        snapshotPrice: listPrice,
        snapshotMinQty: part.minQty,
        snapshotDescription: part.englishDescription || part.description,
        snapshotDistributorDiscount: part.distributorDiscount ?? 0,
      });
    }

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        catalogId,
        userId: req.user.id,
        customerId: customerId || null,
        customerName: displayName || null,
        customerEmail: customerEmail || customerId ? undefined : undefined,
        customerCompany: customerCompany || undefined,
        notes: notes || null,
        total,
        terms: 'Net 30',
      },
    });

    await prisma.quoteItem.createMany({
      data: itemsToCreate.map((it) => ({
        ...it,
        quoteId: quote.id,
      })),
    });

    const created = await prisma.quote.findUnique({
      where: { id: quote.id },
      include: {
        items: true,
        customer: true,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ error: 'Failed to create quote' });
  }
};

/**
 * Update quote
 */
export const updateQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { customerId, customerName, customerEmail, customerCompany, notes, items } = req.body;

    const existing = await prisma.quote.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    const allowed = await canAccessQuote(req.user.id, req.user.role, existing.userId);
    if (!allowed) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    const maxDiscount = ROLE_MAX_DISCOUNT[req.user.role] ?? 10;
    for (const item of items) {
      const discount = Number(item.discountPct) || 0;
      if (discount > maxDiscount) {
        res.status(400).json({
          error: `Discount exceeds your maximum allowed (${maxDiscount}%)`,
        });
        return;
      }
    }

    let displayName = customerName || '';
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (customer) {
        displayName = customer.company ? `${customer.name} (${customer.company})` : customer.name;
      }
    }

    let total = 0;
    const itemsToCreate: any[] = [];

    for (const item of items) {
      const part = await prisma.part.findUnique({
        where: { id: item.partId },
      });
      if (!part) {
        res.status(400).json({ error: `Part ${item.partId} not found` });
        return;
      }

      const listPrice = part.basePrice ?? 0;
      const discountPct = Number(item.discountPct) || 0;
      const marginPct = Number(item.marginPct) || 0;
      const quantity = Math.max(1, parseInt(String(item.quantity), 10) || 1);

      const costPrice = listPrice * (1 - discountPct / 100);
      const sellPrice = costPrice * (1 + marginPct / 100);
      const lineTotal = quantity * sellPrice;
      total += lineTotal;

      itemsToCreate.push({
        quoteId: id,
        partId: part.id,
        partNumber: part.partNumber,
        description: part.englishDescription || part.description,
        quantity,
        packageQty: part.packageQty ?? 1,
        minQty: part.minQty ?? 1,
        discountPct,
        marginPct,
        costPrice,
        sellPrice,
        lineTotal,
        snapshotSeries: part.series || part.partNumber,
        snapshotPartNumber: part.partNumber,
        snapshotPrice: listPrice,
        snapshotMinQty: part.minQty,
        snapshotDescription: part.englishDescription || part.description,
        snapshotDistributorDiscount: part.distributorDiscount ?? 0,
      });
    }

    await prisma.$transaction([
      prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
      prisma.quote.update({
        where: { id },
        data: {
          customerId: customerId || null,
          customerName: displayName || null,
          customerEmail: customerEmail || undefined,
          customerCompany: customerCompany || undefined,
          notes: notes || null,
          total,
        },
      }),
      prisma.quoteItem.createMany({
        data: itemsToCreate,
      }),
    ]);

    const updated = await prisma.quote.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ error: 'Failed to update quote' });
  }
};

/**
 * Delete quote
 */
export const deleteQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    const allowed = await canAccessQuote(req.user.id, req.user.role, quote.userId);
    if (!allowed) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.quote.delete({
      where: { id },
    });

    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
};

/**
 * Download quote as CSV
 */
export const downloadQuoteCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    const allowed = await canAccessQuote(req.user.id, req.user.role, quote.userId);
    if (!allowed) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const rows = quote.items.map((item) => ({
      'Part Number': item.snapshotPartNumber || item.partNumber,
      Description: item.snapshotDescription || item.description,
      Qty: item.quantity,
      'List Price': item.snapshotPrice ?? item.costPrice,
      'Discount %': item.discountPct,
      'Margin %': item.marginPct,
      'Sell Price': item.sellPrice,
      'Line Total': item.lineTotal,
    }));

    const header = rows.length > 0 ? Object.keys(rows[0]).join(',') : 'Part Number,Description,Qty,List Price,Discount %,Margin %,Sell Price,Line Total';
    const lines = rows.map((r) => Object.values(r).map((v) => `"${String(v)}"`).join(','));
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quote.quoteNumber}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Download CSV error:', error);
    res.status(500).json({ error: 'Failed to download quote' });
  }
};

/**
 * Generate quote PDF - stub
 */
export const generateQuotePDF = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(501).json({ error: 'PDF generation not yet implemented' });
};

/**
 * Upload quote from CSV - deprecated in favor of form-based create with bulk import
 */
export const uploadQuoteCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(501).json({ error: 'Use the quote form with bulk import instead' });
};
