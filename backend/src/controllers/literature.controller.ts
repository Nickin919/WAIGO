import { Response } from 'express';
import fs from 'fs/promises';
import { AuthRequest } from '../middleware/auth';
import {
  uploadLiteratureWithAssociations,
  listLiterature,
  getLiteratureById,
  updateAssociations,
  updateZipMilestone,
  getZipMilestone,
  getAllLiteratureForExport,
  exportLiteratureCsv,
  exportLiteraturePdfReport,
  getSampleCsvContent,
  bulkUpdateAssociationsFromCsv,
} from '../lib/literatureService';
import type { LiteratureType } from '@prisma/client';

/**
 * Upload literature PDF with part/series associations (admin).
 */
export const uploadLiterature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded. Use field name "file" for PDF.' });
      return;
    }
    const title = (req.body.title as string)?.trim();
    const type = (req.body.type as string)?.trim();
    if (!title || !type) {
      res.status(400).json({ error: 'title and type are required' });
      return;
    }
    const partIdsRaw = req.body.partIds != null
      ? (Array.isArray(req.body.partIds) ? req.body.partIds : [req.body.partIds]).map(String)
      : [];
    const partIds = partIdsRaw.flatMap((s: string) => s.split(/[,;\s]+/).map((p: string) => p.trim()).filter(Boolean));
    const seriesNamesRaw = req.body.seriesNames != null
      ? (Array.isArray(req.body.seriesNames) ? req.body.seriesNames : [req.body.seriesNames]).map((s: string) => String(s))
      : [];
    const seriesNames = seriesNamesRaw.flatMap((s: string) => s.split(/[,;\n]+/).map((x: string) => x.trim()).filter(Boolean));

    const literature = await uploadLiteratureWithAssociations(
      file,
      { title, description: req.body.description, type, partIds, seriesNames },
      req.user.id
    );
    res.status(201).json(literature);
  } catch (error) {
    console.error('Upload literature error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload literature';
    res.status(400).json({ error: message });
  }
};

/**
 * List literature with optional filters.
 */
export const getLiteratureList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const type = req.query.type as LiteratureType | undefined;
    const partId = req.query.partId as string | undefined;
    const seriesName = req.query.seriesName as string | undefined;
    const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : undefined;
    const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : undefined;
    const result = await listLiterature({ type, partId, seriesName, limit, offset });
    res.json(result);
  } catch (error) {
    console.error('List literature error:', error);
    res.status(500).json({ error: 'Failed to list literature' });
  }
};

/**
 * Get single literature by ID.
 */
export const getLiterature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const literature = await getLiteratureById(id);
    if (!literature) {
      res.status(404).json({ error: 'Literature not found' });
      return;
    }
    res.json(literature);
  } catch (error) {
    console.error('Get literature error:', error);
    res.status(500).json({ error: 'Failed to fetch literature' });
  }
};

/**
 * Update part/series associations for a literature item (admin).
 */
export const patchLiteratureAssociations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const partIds = req.body.partIds != null
      ? (Array.isArray(req.body.partIds) ? req.body.partIds : [req.body.partIds]).map(String).filter(Boolean)
      : [];
    const seriesNames = req.body.seriesNames != null
      ? (Array.isArray(req.body.seriesNames) ? req.body.seriesNames : [req.body.seriesNames]).map((s: string) => String(s).trim()).filter(Boolean)
      : [];

    const literature = await updateAssociations(id, partIds, seriesNames);
    if (!literature) {
      res.status(404).json({ error: 'Literature not found' });
      return;
    }
    res.json(literature);
  } catch (error) {
    console.error('Update associations error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update associations';
    res.status(400).json({ error: message });
  }
};

/**
 * Get zip milestone setting (admin).
 */
export const getZipMilestoneHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const value = await getZipMilestone();
    res.json({ literature_zip_milestone: value });
  } catch (error) {
    console.error('Get zip milestone error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
};

/**
 * Update zip milestone setting (admin).
 */
export const putZipMilestoneHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const value = req.body.literature_zip_milestone ?? req.body.value;
    const bytes = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (!Number.isFinite(bytes) || bytes < 0) {
      res.status(400).json({ error: 'Invalid literature_zip_milestone (positive number of bytes)' });
      return;
    }
    await updateZipMilestone(bytes);
    res.json({ literature_zip_milestone: bytes });
  } catch (error) {
    console.error('Update zip milestone error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
};

/**
 * Export literature report as PDF (admin).
 */
export const exportPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const buffer = await exportLiteraturePdfReport();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="literature-report.pdf"');
    res.send(buffer);
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
};

/**
 * Export literature data as CSV (admin).
 */
export const exportCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const literature = await getAllLiteratureForExport();
    const csv = exportLiteratureCsv(literature);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="literature-export.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
};

/**
 * Download sample CSV for bulk update template (admin).
 */
export const getSampleCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const csv = getSampleCsvContent();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="literature-bulk-update-sample.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Sample CSV error:', error);
    res.status(500).json({ error: 'Failed to get sample CSV' });
  }
};

/**
 * Bulk update associations from uploaded CSV (admin).
 */
export const bulkUpdateAssociations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No CSV file uploaded' });
      return;
    }
    const csvContent = await fs.readFile(file.path, 'utf-8');
    const result = await bulkUpdateAssociationsFromCsv(csvContent, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Bulk update error:', error);
    const message = error instanceof Error ? error.message : 'Bulk update failed';
    res.status(400).json({ error: message });
  }
};
