import { Response } from 'express';
import fs from 'fs';
import Papa from 'papaparse';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const BOM_SAMPLE = 'manufacturer,partNumber,description,quantity,unitPrice\nWAGO,221-413,PCB terminal block 2.5mm,10,0.85\nPhoenix Contact,1234567,Competitor terminal,5,\n';

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        currentRevision: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { items: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        items: {
          where: { projectId: id },
          include: {
            part: {
              select: {
                id: true,
                partNumber: true,
                description: true,
                thumbnailUrl: true
              }
            }
          }
        },
        revisions: {
          orderBy: { revisionNumber: 'desc' }
        }
      }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (project.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        name,
        description,
        status: 'DRAFT'
      }
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description })
      }
    });

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.project.delete({
      where: { id }
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

export const addProjectItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { partId, manufacturer, partNumber, description, quantity, unitPrice, notes } = req.body;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { currentRevision: true, userId: true }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (project.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const item = await prisma.projectItem.create({
      data: {
        projectId: id,
        revisionNumber: project.currentRevision,
        partId,
        manufacturer,
        partNumber,
        description,
        quantity: quantity || 1,
        unitPrice,
        isWagoPart: !!partId,
        notes
      }
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Add project item error:', error);
    res.status(500).json({ error: 'Failed to add project item' });
  }
};

export const getBOMSample = (_req: AuthRequest, res: Response): void => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bom-sample.csv"');
  res.send(BOM_SAMPLE);
};

export const uploadBOM = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = (req as any).file;
    if (!file?.path) {
      res.status(400).json({ error: 'No CSV file uploaded' });
      return;
    }
    const replace = req.query.replace === 'true' || req.query.replace === '1';

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, userId: true, currentRevision: true, status: true }
    });
    if (!project) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (project.userId !== req.user!.id) {
      fs.unlinkSync(file.path);
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    if (project.status !== 'DRAFT') {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Only draft projects can have BOM updated via upload' });
      return;
    }

    const raw = fs.readFileSync(file.path, 'utf-8');
    fs.unlinkSync(file.path);

    const parsed = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
    const rows = parsed.data?.filter((r) => r.partNumber?.trim()) || [];
    if (rows.length === 0) {
      res.status(400).json({ error: 'No valid rows. Required: partNumber; optional: manufacturer, description, quantity, unitPrice' });
      return;
    }

    if (replace) {
      await prisma.projectItem.deleteMany({
        where: { projectId: id, revisionNumber: project.currentRevision }
      });
    }

    let created = 0;
    for (const row of rows) {
      const partNumber = row.partNumber.trim();
      const manufacturer = row.manufacturer?.trim() || null;
      const description = row.description?.trim() || partNumber;
      const quantity = Math.max(1, parseInt(row.quantity, 10) || 1);
      const unitPrice = row.unitPrice?.trim() ? parseFloat(row.unitPrice) : null;

      const wagoPart = await prisma.part.findFirst({
        where: { partNumber },
        select: { id: true }
      });

      await prisma.projectItem.create({
        data: {
          projectId: id,
          revisionNumber: project.currentRevision,
          partId: wagoPart?.id ?? null,
          manufacturer,
          partNumber,
          description,
          quantity,
          unitPrice,
          isWagoPart: !!wagoPart
        }
      });
      created++;
    }

    res.json({ created, totalRows: rows.length });
  } catch (error) {
    console.error('Upload BOM error:', error);
    res.status(500).json({ error: 'Failed to upload BOM' });
  }
};

export const updateProjectItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id: projectId, itemId } = req.params;
    const body = req.body;
    const updateData: Record<string, unknown> = {};
    if (typeof body.quantity === 'number' && body.quantity >= 1) updateData.quantity = body.quantity;
    if (body.panelAccessory === 'PANEL' || body.panelAccessory === 'ACCESSORY' || body.panelAccessory === null) updateData.panelAccessory = body.panelAccessory;
    if (typeof body.notes === 'string') updateData.notes = body.notes;
    if (body.partId != null) {
      const part = await prisma.part.findUnique({ where: { id: body.partId }, select: { id: true, partNumber: true, description: true } });
      if (part) {
        updateData.partId = part.id;
        updateData.partNumber = part.partNumber;
        updateData.description = part.description;
        updateData.isWagoPart = true;
      }
    }

    const existing = await prisma.projectItem.findFirst({
      where: { id: itemId, projectId },
      include: { project: { select: { userId: true } } }
    });
    if (!existing) {
      res.status(404).json({ error: 'Project item not found' });
      return;
    }
    if (existing.project.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const item = await prisma.projectItem.update({
      where: { id: itemId },
      data: updateData
    });

    res.json(item);
  } catch (error) {
    console.error('Update project item error:', error);
    res.status(500).json({ error: 'Failed to update project item' });
  }
};

export const deleteProjectItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id: projectId, itemId } = req.params;

    const existing = await prisma.projectItem.findFirst({
      where: { id: itemId, projectId },
      include: { project: { select: { userId: true } } }
    });
    if (!existing) {
      res.status(404).json({ error: 'Project item not found' });
      return;
    }
    if (existing.project.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    await prisma.projectItem.delete({
      where: { id: itemId }
    });

    res.json({ message: 'Project item deleted successfully' });
  } catch (error) {
    console.error('Delete project item error:', error);
    res.status(500).json({ error: 'Failed to delete project item' });
  }
};

/** Submit project for review: PROCESSING → auto-classify + cross-reference → SUBMITTED */
export const submitProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (project.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    if (project.status !== 'DRAFT') {
      res.status(400).json({ error: 'Only draft projects can be submitted' });
      return;
    }
    if (project.items.length === 0) {
      res.status(400).json({ error: 'Add at least one item to the BOM before submitting' });
      return;
    }

    await prisma.project.update({
      where: { id },
      data: { status: 'PROCESSING' }
    });

    for (const item of project.items) {
      const partNumber = item.partNumber?.trim();
      if (!partNumber) continue;

      const wagoPart = await prisma.part.findFirst({
        where: { partNumber },
        select: { id: true }
      });
      if (wagoPart) {
        await prisma.projectItem.update({
          where: { id: item.id },
          data: { partId: wagoPart.id, isWagoPart: true }
        });
        continue;
      }

      const manufacturer = (item.manufacturer?.trim() || 'Unknown').slice(0, 200);
      const crossRefs = await prisma.crossReference.findMany({
        where: {
          originalPartNumber: { equals: partNumber, mode: 'insensitive' },
          originalManufacturer: { equals: manufacturer, mode: 'insensitive' }
        },
        take: 1
      });
      if (crossRefs.length > 0) {
        await prisma.projectItem.update({
          where: { id: item.id },
          data: { hasWagoEquivalent: true }
        });
      }
    }

    await prisma.project.update({
      where: { id },
      data: { status: 'SUBMITTED' }
    });

    const updated = await prisma.project.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: { select: { id: true, partNumber: true, description: true, thumbnailUrl: true } }
          }
        }
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Submit project error:', error);
    res.status(500).json({ error: 'Failed to submit project' });
  }
};

/** Set project to COMPLETED (after user accepts & finalizes). Only when SUBMITTED. */
export const finalizeProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true, status: true }
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (project.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    if (project.status !== 'SUBMITTED') {
      res.status(400).json({ error: 'Only submitted projects can be finalized' });
      return;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { status: 'COMPLETED' }
    });
    res.json(updated);
  } catch (error) {
    console.error('Finalize project error:', error);
    res.status(500).json({ error: 'Failed to finalize project' });
  }
};

export const suggestWagoUpgrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true }
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (project.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const items = await prisma.projectItem.findMany({
      where: { projectId: id },
      select: { id: true, manufacturer: true, partNumber: true, partId: true, isWagoPart: true }
    });

    const suggestions: Array<{
      itemId: string;
      partNumber: string;
      manufacturer: string | null;
      wagoEquivalents: Array<{
        wagoPartId: string;
        partNumber: string;
        description: string;
        compatibilityScore: number;
        notes: string | null;
      }>;
    }> = [];

    for (const item of items) {
      if (item.isWagoPart || item.partId) continue;
      const partNumber = item.partNumber?.trim();
      if (!partNumber) continue;

      const manufacturer = (item.manufacturer?.trim() || 'Unknown').slice(0, 200);
      const crossRefs = await prisma.crossReference.findMany({
        where: {
          originalPartNumber: { equals: partNumber, mode: 'insensitive' },
          originalManufacturer: { equals: manufacturer, mode: 'insensitive' }
        },
        include: {
          wagoPart: { select: { id: true, partNumber: true, description: true } }
        },
        orderBy: { compatibilityScore: 'desc' }
      });

      if (crossRefs.length > 0) {
        suggestions.push({
          itemId: item.id,
          partNumber: item.partNumber,
          manufacturer: item.manufacturer,
          wagoEquivalents: crossRefs.map((ref) => ({
            wagoPartId: ref.wagoPart.id,
            partNumber: ref.wagoPart.partNumber,
            description: ref.wagoPart.description,
            compatibilityScore: ref.compatibilityScore,
            notes: ref.notes
          }))
        });
      }
    }

    res.json({ suggestions });
  } catch (error) {
    console.error('Suggest upgrades error:', error);
    res.status(500).json({ error: 'Failed to suggest upgrades' });
  }
};

export const applyWagoUpgrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id: projectId } = req.params;
    const { itemId, wagoPartId } = req.body;

    if (!itemId || !wagoPartId) {
      res.status(400).json({ error: 'itemId and wagoPartId are required' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true }
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (project.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const wagoPart = await prisma.part.findUnique({
      where: { id: wagoPartId },
      select: { id: true, partNumber: true, description: true }
    });
    if (!wagoPart) {
      res.status(404).json({ error: 'WAGO part not found' });
      return;
    }

    const item = await prisma.projectItem.findFirst({
      where: { id: itemId, projectId }
    });
    if (!item) {
      res.status(404).json({ error: 'Project item not found' });
      return;
    }

    const updated = await prisma.projectItem.update({
      where: { id: itemId },
      data: {
        partId: wagoPart.id,
        partNumber: wagoPart.partNumber,
        description: wagoPart.description,
        isWagoPart: true,
        hasWagoEquivalent: true
      },
      include: {
        part: { select: { id: true, partNumber: true, description: true, thumbnailUrl: true } }
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Apply upgrade error:', error);
    res.status(500).json({ error: 'Failed to apply upgrade' });
  }
};

export const createRevision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { changeSummary } = req.body;

    if (!changeSummary) {
      res.status(400).json({ error: 'changeSummary is required' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { currentRevision: true }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const newRevisionNumber = project.currentRevision + 1;

    const revision = await prisma.projectRevision.create({
      data: {
        projectId: id,
        revisionNumber: newRevisionNumber,
        changeSummary
      }
    });

    await prisma.project.update({
      where: { id },
      data: { currentRevision: newRevisionNumber }
    });

    res.status(201).json(revision);
  } catch (error) {
    console.error('Create revision error:', error);
    res.status(500).json({ error: 'Failed to create revision' });
  }
};

export const getRevisions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const revisions = await prisma.projectRevision.findMany({
      where: { projectId: id },
      orderBy: { revisionNumber: 'desc' }
    });

    res.json(revisions);
  } catch (error) {
    console.error('Get revisions error:', error);
    res.status(500).json({ error: 'Failed to fetch revisions' });
  }
};

// ---------------------------------------------------------------------------
// Report (Phase 3)
// ---------------------------------------------------------------------------

type ReportData = {
  project: { id: string; name: string; description: string | null; status: string };
  summary: { itemCount: number; wagoCount: number; nonWagoCount: number };
  items: Array<{
    partNumber: string;
    manufacturer: string | null;
    description: string;
    quantity: number;
    unitPrice: number | null;
    isWagoPart: boolean;
    panelAccessory: string | null;
  }>;
  costSummary: { totalEstimated: number; lineCountWithPrice: number };
  advantages: string[];
};

async function getReportData(projectId: string, userId: string): Promise<ReportData | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      items: { orderBy: { createdAt: 'asc' } }
    }
  });
  if (!project || project.userId !== userId) return null;
  if (project.status !== 'COMPLETED') return null;

  const items = project.items;
  const wagoCount = items.filter((i) => i.isWagoPart).length;
  let totalEstimated = 0;
  let lineCountWithPrice = 0;
  for (const i of items) {
    if (i.unitPrice != null) {
      totalEstimated += i.quantity * i.unitPrice;
      lineCountWithPrice += 1;
    }
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status
    },
    summary: {
      itemCount: items.length,
      wagoCount,
      nonWagoCount: items.length - wagoCount
    },
    items: items.map((i) => ({
      partNumber: i.partNumber,
      manufacturer: i.manufacturer,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      isWagoPart: i.isWagoPart,
      panelAccessory: i.panelAccessory
    })),
    costSummary: { totalEstimated, lineCountWithPrice },
    advantages: [
      'Single source supply – WAGO as one partner for connectivity',
      'Proven quality and reliability in industrial applications',
      'Global availability and technical support',
      'Consistent product performance and compatibility'
    ]
  };
}

export const getProjectReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;
    const format = (req.query.format as string)?.toLowerCase();

    const report = await getReportData(id, req.user.id);
    if (!report) {
      res.status(404).json({ error: 'Project not found or report only available for completed projects' });
      return;
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="project-report-${id.slice(0, 8)}.pdf"`);
      doc.pipe(res);
      doc.fontSize(18).text(report.project.name, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Items: ${report.summary.itemCount} | WAGO: ${report.summary.wagoCount} | Non-WAGO: ${report.summary.nonWagoCount}`);
      doc.text(`Estimated total: ${report.costSummary.totalEstimated.toFixed(2)} (${report.costSummary.lineCountWithPrice} lines with price)`);
      doc.moveDown();
      doc.fontSize(12).text('BOM', { underline: true });
      doc.moveDown(0.5);
      let y = doc.y;
      const rowHeight = 18;
      doc.fontSize(9);
      doc.text('Part #', 50, y); doc.text('Manufacturer', 120, y); doc.text('Description', 200, y);
      doc.text('Qty', 380, y); doc.text('Price', 420, y); doc.text('Type', 480, y);
      y += rowHeight;
      for (const row of report.items) {
        if (y > 700) { doc.addPage(); y = 50; doc.text('Part #', 50, y); doc.text('Manufacturer', 120, y); doc.text('Description', 200, y); doc.text('Qty', 380, y); doc.text('Price', 420, y); doc.text('Type', 480, y); y += rowHeight; }
        doc.text((row.partNumber || '').slice(0, 12), 50, y);
        doc.text((row.manufacturer || '').slice(0, 10), 120, y);
        doc.text((row.description || '').slice(0, 28), 200, y);
        doc.text(String(row.quantity), 380, y);
        doc.text(row.unitPrice != null ? row.unitPrice.toFixed(2) : '—', 420, y);
        doc.text(row.isWagoPart ? 'WAGO' : 'Other', 480, y);
        y += rowHeight;
      }
      doc.moveDown();
      doc.fontSize(11).text('Advantages', { underline: true });
      doc.fontSize(9);
      report.advantages.forEach((a) => { doc.text(`• ${a}`); });
      doc.end();
      return;
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'WAGO Project Hub';
      const sheet = workbook.addWorksheet('BOM', { headerFooter: { firstHeader: report.project.name } });
      sheet.columns = [
        { header: 'Part #', key: 'partNumber', width: 16 },
        { header: 'Manufacturer', key: 'manufacturer', width: 14 },
        { header: 'Description', key: 'description', width: 36 },
        { header: 'Qty', key: 'quantity', width: 6 },
        { header: 'Unit Price', key: 'unitPrice', width: 10 },
        { header: 'Type', key: 'type', width: 10 }
      ];
      sheet.getRow(1).font = { bold: true };
      for (const row of report.items) {
        sheet.addRow({
          partNumber: row.partNumber,
          manufacturer: row.manufacturer ?? '',
          description: row.description,
          quantity: row.quantity,
          unitPrice: row.unitPrice ?? '',
          type: row.isWagoPart ? 'WAGO' : 'Other'
        });
      }
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['Project', report.project.name]);
      summarySheet.addRow(['Item count', report.summary.itemCount]);
      summarySheet.addRow(['WAGO items', report.summary.wagoCount]);
      summarySheet.addRow(['Non-WAGO items', report.summary.nonWagoCount]);
      summarySheet.addRow(['Estimated total', report.costSummary.totalEstimated]);
      summarySheet.addRow([]);
      summarySheet.addRow(['Advantages']);
      report.advantages.forEach((a) => summarySheet.addRow([a]));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="project-report-${id.slice(0, 8)}.xlsx"`);
      await workbook.xlsx.write(res);
      return;
    }

    res.json(report);
  } catch (error) {
    console.error('Get project report error:', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
};

export const emailProjectReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { id } = req.params;
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Valid email address is required' });
      return;
    }

    const report = await getReportData(id, req.user.id);
    if (!report) {
      res.status(404).json({ error: 'Project not found or report not available' });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined
    });

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(18).text(report.project.name, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Items: ${report.summary.itemCount} | WAGO: ${report.summary.wagoCount} | Non-WAGO: ${report.summary.nonWagoCount}`);
      doc.text(`Estimated total: ${report.costSummary.totalEstimated.toFixed(2)}`);
      doc.moveDown();
      doc.fontSize(12).text('BOM', { underline: true });
      doc.moveDown(0.5);
      let y = doc.y;
      const rowHeight = 18;
      doc.fontSize(9);
      doc.text('Part #', 50, y); doc.text('Description', 150, y); doc.text('Qty', 350, y); doc.text('Type', 400, y);
      y += rowHeight;
      for (const row of report.items) {
        if (y > 700) { doc.addPage(); y = 50; doc.text('Part #', 50, y); doc.text('Description', 150, y); doc.text('Qty', 350, y); doc.text('Type', 400, y); y += rowHeight; }
        doc.text((row.partNumber || '').slice(0, 20), 50, y);
        doc.text((row.description || '').slice(0, 35), 150, y);
        doc.text(String(row.quantity), 350, y);
        doc.text(row.isWagoPart ? 'WAGO' : 'Other', 400, y);
        y += rowHeight;
      }
      doc.end();
    });
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@wago-project-hub.local';

    await transporter.sendMail({
      from: fromEmail,
      to: email.trim(),
      subject: `Project Report: ${report.project.name}`,
      text: `Your project report "${report.project.name}" is attached.\n\nSummary: ${report.summary.itemCount} items (${report.summary.wagoCount} WAGO, ${report.summary.nonWagoCount} other). Estimated total: ${report.costSummary.totalEstimated.toFixed(2)}.`,
      attachments: [{ filename: `project-report-${id.slice(0, 8)}.pdf`, content: pdfBuffer }]
    });

    res.json({ message: 'Report sent to ' + email.trim() });
  } catch (error) {
    console.error('Email report error:', error);
    res.status(500).json({ error: 'Failed to send report email' });
  }
};
