import { Response } from 'express';
import fs from 'fs';
import Papa from 'papaparse';
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

export const suggestWagoUpgrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // TODO: Implement cross-reference suggestions
    res.status(501).json({ error: 'Upgrade suggestions not yet implemented' });
  } catch (error) {
    console.error('Suggest upgrades error:', error);
    res.status(500).json({ error: 'Failed to suggest upgrades' });
  }
};

export const applyWagoUpgrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // TODO: Implement applying upgrade
    res.status(501).json({ error: 'Apply upgrade not yet implemented' });
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
