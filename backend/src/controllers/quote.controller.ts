import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getSubordinateUserIds } from '../lib/hierarchy';
import { effectiveRole, isInternal } from '../lib/roles';
import { sendQuoteEmail } from '../lib/emailService';
import { buildQuotePdfBuffer } from '../lib/quotePdf';
import {
  getSuggestedLiteratureForQuote,
  attachToQuote,
  getQuoteLiterature,
  generateLiteraturePack,
} from '../lib/literatureService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function canAccessQuote(userId: string, userRole: string, quoteUserId: string): Promise<boolean> {
  const subordinateIds = await getSubordinateUserIds(userId, userRole);
  return subordinateIds.includes(quoteUserId);
}

/** Check if user may use a price contract (ADMIN/RSM or assigned) */
async function canUsePriceContract(userId: string, userRole: string, contractId: string): Promise<boolean> {
  if (isInternal(userRole)) return true;
  const assignment = await prisma.userPriceContractAssignment.findUnique({
    where: { userId_contractId: { userId, contractId } },
  });
  return !!assignment;
}

/** Resolve MASTER catalog part by part number; returns basePrice and minQty from master or fallback part */
async function resolveMasterListAndMinQty(
  part: { partNumber: string; basePrice: number | null; minQty: number; catalogId: string }
): Promise<{ listPrice: number; minQty: number }> {
  const masterCatalog = await prisma.catalog.findFirst({
    where: { isMaster: true, isActive: true },
    select: { id: true },
  });
  if (!masterCatalog || masterCatalog.id === part.catalogId) {
    return { listPrice: part.basePrice ?? 0, minQty: part.minQty };
  }
  const masterPart = await prisma.part.findUnique({
    where: {
      catalogId_partNumber: { catalogId: masterCatalog.id, partNumber: part.partNumber },
    },
    select: { basePrice: true, minQty: true },
  });
  if (!masterPart) {
    return { listPrice: part.basePrice ?? 0, minQty: part.minQty };
  }
  return {
    listPrice: masterPart.basePrice ?? part.basePrice ?? 0,
    minQty: masterPart.minQty ?? part.minQty,
  };
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
        priceContract: { select: { id: true, name: true } },
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

    const { catalogId, priceContractId, customerId, customerName, customerEmail, customerCompany, notes, terms: bodyTerms, items } = req.body;

    if (!catalogId) {
      res.status(400).json({ error: 'catalogId is required' });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    // Role-based discount limit removed per product requirement; no validation here.
    if (priceContractId) {
      const contract = await prisma.priceContract.findUnique({ where: { id: priceContractId } });
      if (!contract) {
        res.status(400).json({ error: 'Price contract not found' });
        return;
      }
      const allowed = await canUsePriceContract(req.user.id, req.user.role, priceContractId);
      if (!allowed) {
        res.status(403).json({ error: 'You do not have access to this price contract' });
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

    const quoteOwner = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    const defaultTermsFromProfile = (quoteOwner as { defaultTerms?: string | null } | null)?.defaultTerms ?? null;
    const termsValue = bodyTerms != null && String(bodyTerms).trim() !== '' ? String(bodyTerms).trim() : (defaultTermsFromProfile ?? 'Net 30');

    const contractItems = priceContractId
      ? await prisma.priceContractItem.findMany({
          where: { contractId: priceContractId },
          select: { partId: true, seriesOrGroup: true, costPrice: true },
        })
      : [];

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

      const { listPrice, minQty: snapshotMinQty } = await resolveMasterListAndMinQty(part);
      const discountPct = Number(item.discountPct) || 0;
      const marginPct = Number(item.marginPct) || 0;
      const quantity = Math.max(1, parseInt(String(item.quantity), 10) || 1);

      const contractMatch = contractItems.length
        ? contractItems.find(
            (ci) =>
              ci.partId === part.id ||
              (ci.seriesOrGroup && (part.series || part.partNumber || '').toUpperCase().includes((ci.seriesOrGroup as string).toUpperCase())) ||
              (ci.seriesOrGroup && (part.partNumber || '').toUpperCase() === (ci.seriesOrGroup as string).toUpperCase())
          )
        : null;
      const costPrice =
        contractMatch != null ? contractMatch.costPrice : listPrice * (1 - discountPct / 100);
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
        minQty: snapshotMinQty,
        discountPct,
        marginPct,
        costPrice,
        sellPrice,
        lineTotal,
        isCostAffected: Boolean(item.isCostAffected),
        isSellAffected: Boolean(item.isSellAffected),
        snapshotSeries: part.series || part.partNumber,
        snapshotPartNumber: part.partNumber,
        snapshotPrice: listPrice,
        snapshotMinQty,
        snapshotDescription: part.englishDescription || part.description,
        snapshotDistributorDiscount: part.distributorDiscount ?? 0,
      });
    }

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        catalogId,
        priceContractId: priceContractId || null,
        userId: req.user.id,
        customerId: customerId || null,
        customerName: displayName || null,
        customerEmail: customerEmail || customerId ? undefined : undefined,
        customerCompany: customerCompany || undefined,
        notes: notes || null,
        total,
        terms: termsValue,
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
    const { customerId, customerName, customerEmail, customerCompany, notes, terms: bodyTerms, priceContractId, items } = req.body;

    const existing = await prisma.quote.findUnique({
      where: { id },
      select: { userId: true, priceContractId: true },
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

    // Role-based discount limit removed per product requirement; no validation here.
    if (priceContractId !== undefined) {
      if (priceContractId) {
        const contract = await prisma.priceContract.findUnique({ where: { id: priceContractId } });
        if (!contract) {
          res.status(400).json({ error: 'Price contract not found' });
          return;
        }
        const allowed = await canUsePriceContract(req.user.id, req.user.role, priceContractId);
        if (!allowed) {
          res.status(403).json({ error: 'You do not have access to this price contract' });
          return;
        }
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

    const contractIdForUpdate =
      priceContractId !== undefined ? (priceContractId || null) : (existing!.priceContractId ?? null);
    const contractItems = contractIdForUpdate
      ? await prisma.priceContractItem.findMany({
          where: { contractId: contractIdForUpdate },
          select: { partId: true, seriesOrGroup: true, costPrice: true },
        })
      : [];

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

      const { listPrice, minQty: snapshotMinQty } = await resolveMasterListAndMinQty(part);
      const discountPct = Number(item.discountPct) || 0;
      const marginPct = Number(item.marginPct) || 0;
      const quantity = Math.max(1, parseInt(String(item.quantity), 10) || 1);

      const contractMatch = contractItems.length
        ? contractItems.find(
            (ci) =>
              ci.partId === part.id ||
              (ci.seriesOrGroup && (part.series || part.partNumber || '').toUpperCase().includes((ci.seriesOrGroup as string).toUpperCase())) ||
              (ci.seriesOrGroup && (part.partNumber || '').toUpperCase() === (ci.seriesOrGroup as string).toUpperCase())
          )
        : null;
      const costPrice =
        contractMatch != null ? contractMatch.costPrice : listPrice * (1 - discountPct / 100);
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
        minQty: snapshotMinQty,
        discountPct,
        marginPct,
        costPrice,
        sellPrice,
        lineTotal,
        isCostAffected: Boolean(item.isCostAffected),
        isSellAffected: Boolean(item.isSellAffected),
        snapshotSeries: part.series || part.partNumber,
        snapshotPartNumber: part.partNumber,
        snapshotPrice: listPrice,
        snapshotMinQty: snapshotMinQty,
        snapshotDescription: part.englishDescription || part.description,
        snapshotDistributorDiscount: part.distributorDiscount ?? 0,
      });
    }

    const updateData: { customerId?: string | null; customerName?: string | null; customerEmail?: string; customerCompany?: string; notes?: string | null; terms?: string; total: number; priceContractId?: string | null } = {
      customerId: customerId || null,
      customerName: displayName || null,
      customerEmail: customerEmail || undefined,
      customerCompany: customerCompany || undefined,
      notes: notes || null,
      total,
    };
    if (priceContractId !== undefined) {
      updateData.priceContractId = priceContractId || null;
    }
    if (bodyTerms !== undefined) {
      updateData.terms = bodyTerms === '' || bodyTerms == null ? 'Net 30' : String(bodyTerms).trim();
    }
    await prisma.$transaction([
      prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
      prisma.quote.update({
        where: { id },
        data: updateData,
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
 * Get literature suggested for this quote (by part/series on quote items).
 */
export const getSuggestedLiteratureHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;
    const quote = await prisma.quote.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    const allowed = await canAccessQuote(req.user.id, req.user.role, quote.userId);
    if (!allowed) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const list = await getSuggestedLiteratureForQuote(id);
    res.json(list);
  } catch (error) {
    console.error('Get suggested literature error:', error);
    res.status(500).json({ error: 'Failed to get suggested literature' });
  }
};

/**
 * Attach literature items to a quote.
 */
export const attachLiteratureHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;
    const literatureIds = Array.isArray(req.body.literatureIds) ? req.body.literatureIds : [req.body.literatureIds].filter(Boolean);
    if (!literatureIds.length) {
      res.status(400).json({ error: 'literatureIds array is required' });
      return;
    }
    const quote = await prisma.quote.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    const allowed = await canAccessQuote(req.user.id, req.user.role, quote.userId);
    if (!allowed) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const list = await attachToQuote(id, literatureIds);
    res.json(list);
  } catch (error) {
    console.error('Attach literature error:', error);
    res.status(500).json({ error: 'Failed to attach literature' });
  }
};

/**
 * Get literature attached to a quote.
 */
export const getQuoteLiteratureHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;
    const quote = await prisma.quote.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    const allowed = await canAccessQuote(req.user.id, req.user.role, quote.userId);
    if (!allowed) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const list = await getQuoteLiterature(id);
    res.json(list);
  } catch (error) {
    console.error('Get quote literature error:', error);
    res.status(500).json({ error: 'Failed to get quote literature' });
  }
};

/**
 * Send quote by email (Resend). Recipient: body.to or quote.customerEmail.
 */
export const sendQuoteEmailHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const toOverride = req.body?.to as string | undefined;

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

    const to = (toOverride ?? quote.customerEmail ?? '').trim();
    if (!to) {
      res.status(400).json({
        error: 'No recipient. Set quote customer email or pass "to" in the request body.',
      });
      return;
    }
    if (!EMAIL_REGEX.test(to)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    const customerName = quote.customerName ?? 'Customer';
    const itemCount = quote.items.length;
    const quoteSummary = `Quote ${quote.quoteNumber} includes ${itemCount} item(s) with a total of $${Number(quote.total).toFixed(2)}.`;

    const literatureAttachments: { filename: string; content: Buffer }[] = [];
    try {
      const pack = await generateLiteraturePack(quote.id);
      if (pack.buffer.length > 0 && pack.filename) {
        literatureAttachments.push({ filename: pack.filename, content: pack.buffer });
      }
    } catch (packErr) {
      console.warn('Literature pack skipped for quote email:', packErr);
    }

    await sendQuoteEmail({
      to,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerName,
      quoteSummary,
      literatureAttachments: literatureAttachments.length ? literatureAttachments : undefined,
    });

    if (!quote.sentAt) {
      await prisma.quote.update({
        where: { id },
        data: { sentAt: new Date() },
      });
    }

    res.json({ message: 'Quote sent successfully to ' + to });
  } catch (error) {
    console.error('Send quote email error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send quote email';
    const isNotConfigured = message.includes('RESEND_API_KEY');
    res.status(isNotConfigured ? 503 : 500).json({
      error: isNotConfigured
        ? 'Quote email is not configured. Set RESEND_API_KEY in the server environment.'
        : message,
    });
  }
};

/**
 * GET /quotes/:id/pdf – generate Pricing Proposal PDF (Style B).
 */
export const generateQuotePDF = async (req: AuthRequest, res: Response): Promise<void> => {
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
          select: {
            id: true,
            role: true,
            logoUrl: true,
            avatarUrl: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            assignedToRsm: {
              select: { firstName: true, lastName: true, email: true, phone: true, logoUrl: true, avatarUrl: true },
            },
            assignedToDistributor: {
              select: { firstName: true, lastName: true, email: true, phone: true, logoUrl: true, avatarUrl: true },
            },
          },
        },
        customer: { select: { name: true, address: true, city: true, state: true, zipCode: true, email: true } },
        priceContract: { select: { name: true } },
        items: true,
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
    const pdfPayload = {
      quoteNumber: quote.quoteNumber,
      customerName: quote.customerName,
      customerCompany: quote.customerCompany,
      customerEmail: quote.customerEmail,
      notes: quote.notes,
      terms: quote.terms,
      total: quote.total,
      validUntil: quote.validUntil,
      createdAt: quote.createdAt,
      priceContract: quote.priceContract,
      customer: quote.customer,
      items: quote.items.map((it) => ({
        partNumber: it.partNumber,
        snapshotPartNumber: it.snapshotPartNumber,
        description: it.description,
        snapshotDescription: it.snapshotDescription,
        quantity: it.quantity,
        sellPrice: it.sellPrice,
        lineTotal: it.lineTotal,
        isCostAffected: it.isCostAffected,
        isSellAffected: it.isSellAffected,
      })),
      user: quote.user,
    };
    const buffer = await buildQuotePdfBuffer(pdfPayload);
    const filename = `PricingProposal_${quote.quoteNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Generate quote PDF error:', error);
    res.status(500).json({ error: 'Failed to generate quote PDF' });
  }
};

/**
 * Upload quote from CSV - deprecated in favor of form-based create with bulk import
 */
export const uploadQuoteCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(501).json({ error: 'Use the quote form with bulk import instead' });
};
