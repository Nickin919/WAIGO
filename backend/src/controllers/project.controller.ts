import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      include: {
        _count: {
          select: { items: true }
        }
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
        description
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
      select: { currentRevision: true }
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
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

export const uploadBOM = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // TODO: Implement BOM CSV upload
    res.status(501).json({ error: 'BOM upload not yet implemented' });
  } catch (error) {
    console.error('Upload BOM error:', error);
    res.status(500).json({ error: 'Failed to upload BOM' });
  }
};

export const updateProjectItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const updateData = req.body;

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
    const { itemId } = req.params;

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
