import { Response } from 'express';
import fs from 'fs/promises';
import { AuthRequest } from '../middleware/auth';
import {
  uploadLiteratureWithAssociations,
  listLiterature,
  getLiteratureById,
  updateAssociations,
  updateLiteratureMetadata,
  deleteLiterature,
  updateZipMilestone,
  getZipMilestone,
  getAllLiteratureForExport,
  exportLiteratureCsv,
  exportLiteraturePdfReport,
  getSampleCsvContent,
  bulkUpdateAssociationsFromCsv,
} from '../lib/literatureService';
import type { LiteratureType } from '@prisma/client';

/** Upload literature PDF with part/series/keyword associations (admin). */
export const uploadLiterature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file uploaded. Use field name "file" for PDF.' }); return; }

    const title = (req.body.title as string)?.trim();
    const type = (req.body.type as string)?.trim();
    if (!title || !type) { res.status(400).json({ error: 'title and type are required' }); return; }

    const parseList = (val: unknown): string[] => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : [val];
      return arr.flatMap((s: unknown) => String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean));
    };

    const partNumbers = parseList(req.body.partNumbers);
    const seriesNames = parseList(req.body.seriesNames);
    const keywords = parseList(req.body.keywords);
    const industryTags = parseList(req.body.industryTags);

    const { literature, unresolvedParts } = await uploadLiteratureWithAssociations(
      file,
      { title, description: req.body.description, type, partNumbers, seriesNames, keywords, industryTags },
      req.user.id
    );
    res.status(201).json({ literature, unresolvedParts });
  } catch (error) {
    console.error('Upload literature error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload literature';
    res.status(400).json({ error: message });
  }
};

/** List literature with optional filters. */
export const getLiteratureList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const type = req.query.type as LiteratureType | undefined;
    const partId = req.query.partId as string | undefined;
    const partNumber = req.query.partNumber as string | undefined;
    const seriesName = req.query.seriesName as string | undefined;
    const search = req.query.search as string | undefined;
    const keyword = req.query.keyword as string | undefined;
    const industryTag = req.query.industryTag as string | undefined;
    const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : undefined;
    const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : undefined;

    const result = await listLiterature({ type, partId, partNumber, seriesName, search, keyword, industryTag, limit, offset });
    res.json(result);
  } catch (error) {
    console.error('List literature error:', error);
    res.status(500).json({ error: 'Failed to list literature' });
  }
};

/** Get single literature by ID. */
export const getLiterature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const literature = await getLiteratureById(id);
    if (!literature) { res.status(404).json({ error: 'Literature not found' }); return; }
    res.json(literature);
  } catch (error) {
    console.error('Get literature error:', error);
    res.status(500).json({ error: 'Failed to fetch literature' });
  }
};

/** Update metadata (title, description, type, keywords, industryTags) — admin only. */
export const patchLiteratureMetadata = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, type, keywords, industryTags } = req.body;

    const parseTagList = (val: unknown): string[] | undefined => {
      if (val === undefined) return undefined;
      if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
      return String(val).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    };

    const literature = await updateLiteratureMetadata(id, {
      title,
      description,
      type,
      keywords: parseTagList(keywords),
      industryTags: parseTagList(industryTags),
    });
    res.json(literature);
  } catch (error) {
    console.error('Update literature metadata error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update literature';
    res.status(400).json({ error: message });
  }
};

/** Update part/series associations for a literature item (admin). */
export const patchLiteratureAssociations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parseList = (val: unknown): string[] => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : [val];
      return arr.flatMap((s: unknown) => String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean));
    };
    const partNumbers = parseList(req.body.partNumbers);
    const seriesNames = parseList(req.body.seriesNames);

    const literature = await updateAssociations(id, partNumbers, seriesNames);
    if (!literature) { res.status(404).json({ error: 'Literature not found' }); return; }
    res.json(literature);
  } catch (error) {
    console.error('Update associations error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update associations';
    res.status(400).json({ error: message });
  }
};

/** Delete a literature item and its R2 file — admin only. */
export const deleteLiteratureHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await deleteLiterature(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete literature error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete literature';
    res.status(400).json({ error: message });
  }
};

/** Get zip milestone setting (admin). */
export const getZipMilestoneHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const value = await getZipMilestone();
    res.json({ literature_zip_milestone: value });
  } catch (error) {
    console.error('Get zip milestone error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
};

/** Update zip milestone setting (admin). */
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

/** Export literature report as PDF (admin). */
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

/** Export literature data as CSV (admin). */
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

/** Download sample CSV for bulk update template (admin). */
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

/** Bulk update associations from uploaded CSV (admin). */
export const bulkUpdateAssociations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    const csvContent = await fs.readFile(file.path, 'utf-8');
    const result = await bulkUpdateAssociationsFromCsv(csvContent, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Bulk update error:', error);
    const message = error instanceof Error ? error.message : 'Bulk update failed';
    res.status(400).json({ error: message });
  }
};
