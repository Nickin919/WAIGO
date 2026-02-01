import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import Papa from 'papaparse';
import fs from 'fs';

/**
 * Get quotes
 */
export const getQuotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const where: any = {};
    
    // Non-admins can only see their own quotes
    if (req.user.role !== 'ADMIN') {
      where.userId = req.user.id;
    }

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
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
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        items: {
          include: {
            part: {
              select: {
                id: true,
                thumbnailUrl: true
              }
            }
          }
        },
        discounts: true
      }
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Check authorization
    if (req.user.role !== 'ADMIN' && quote.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    res.json(quote);
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
};

/**
 * Create quote
 */
export const createQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const {
      catalogId,
      customerName,
      customerEmail,
      customerCompany,
      note,
      validUntil,
      fob,
      terms
    } = req.body;

    if (!catalogId) {
      res.status(400).json({ error: 'catalogId is required' });
      return;
    }

    // Generate quote number
    const count = await prisma.quote.count();
    const quoteNumber = `PP#${(count + 1).toString().padStart(6, '0')}`;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        catalogId,
        userId: req.user.id,
        customerName,
        customerEmail,
        customerCompany,
        note,
        validUntil: validUntil ? new Date(validUntil) : null,
        fob,
        terms: terms || 'Net 30'
      }
    });

    res.status(201).json(quote);
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ error: 'Failed to create quote' });
  }
};

/**
 * Upload quote from CSV
 */
export const uploadQuoteCSV = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.file) {
      res.status(400).json({ error: 'File required' });
      return;
    }

    const csvContent = fs.readFileSync(req.file.path, 'utf-8');
    const parsed = Papa.parse(csvContent, { header: true });

    // TODO: Process CSV data and create quote items
    // Expected columns: Part Number, Min Qty, Price each, Sell Price, Valid until, Category, Series, Discount Percent

    res.json({
      message: 'CSV uploaded successfully',
      preview: parsed.data.slice(0, 10)
    });
  } catch (error) {
    console.error('Upload CSV error:', error);
    res.status(500).json({ error: 'Failed to upload CSV' });
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
      include: {
        items: {
          include: {
            part: true
          }
        }
      }
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Generate CSV
    const csvData = quote.items.map(item => ({
      'Part Number': item.partNumber,
      'Description': item.description,
      'Min Qty': item.minQty,
      'Package Qty': item.packageQty,
      'Cost Price': item.costPrice,
      'Sell Price': item.sellPrice || ''
    }));

    const csv = Papa.unparse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quote.quoteNumber}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Download CSV error:', error);
    res.status(500).json({ error: 'Failed to download CSV' });
  }
};

/**
 * Generate quote PDF
 */
export const generateQuotePDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // TODO: Implement PDF generation with pdf-lib or jsPDF
    res.status(501).json({ error: 'PDF generation not yet implemented' });
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
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
    const updateData = req.body;

    const quote = await prisma.quote.update({
      where: { id },
      data: updateData
    });

    res.json(quote);
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
    const { id } = req.params;

    await prisma.quote.delete({
      where: { id }
    });

    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
};
