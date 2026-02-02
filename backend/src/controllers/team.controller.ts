import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { effectiveRole, isInternal } from '../lib/roles';

/**
 * Get teams (filtered by user role)
 */
export const getTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let where: any = {};

    const role = effectiveRole(req.user.role);
    switch (role) {
      case 'ADMIN':
      case 'RSM':
        // Can see all teams
        break;

      case 'DISTRIBUTOR_REP':
        // Can see teams of assigned users
        where.members = {
          some: {
            assignedToDistributorId: req.user.id
          }
        };
        break;

      case 'DIRECT_USER':
        // Can only see own team
        if (req.user.turnkeyTeamId) {
          where.id = req.user.turnkeyTeamId;
        } else {
          res.json([]);
          return;
        }
        break;

      default:
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
    }

    const teams = await prisma.turnkeyTeam.findMany({
      where,
      include: {
        members: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        _count: {
          select: {
            members: true,
            costTables: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

/**
 * Get team by ID
 */
export const getTeamById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const team = await prisma.turnkeyTeam.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        },
        costTables: {
          include: {
            _count: {
              select: { items: true }
            }
          }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permissions
    const isMember = team.members.some(m => m.id === req.user!.id);
    const canView = isInternal(req.user.role) || 
                    (effectiveRole(req.user.role) === 'DISTRIBUTOR_REP' && team.members.some(m => m.id === req.user!.id)) ||
                    isMember;

    if (!canView) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(team);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

/**
 * Create new team (RSM or ADMIN only)
 */
export const createTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const team = await prisma.turnkeyTeam.create({
      data: {
        name,
        description,
        createdById: req.user.id
      }
    });

    res.status(201).json(team);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

/**
 * Add member to team (RSM or ADMIN only)
 */
export const addTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { teamId, userId } = req.body;

    if (!teamId || !userId) {
      res.status(400).json({ error: 'teamId and userId are required' });
      return;
    }

    // Verify user is TURNKEY role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || effectiveRole(user.role) !== 'DIRECT_USER') {
      res.status(400).json({ error: 'User must have Direct (formerly TurnKey) role' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { turnkeyTeamId: teamId }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
};

/**
 * Remove member from team
 */
export const removeTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { teamId, userId } = req.params;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { turnkeyTeamId: null }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
};

/**
 * Update team
 */
export const updateTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;
    const { name, description } = req.body;

    const team = await prisma.turnkeyTeam.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description })
      }
    });

    res.json(team);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

/**
 * Delete team
 */
export const deleteTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || effectiveRole(req.user.role) !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;

    // First, remove team association from all members
    await prisma.user.updateMany({
      where: { turnkeyTeamId: id },
      data: { turnkeyTeamId: null }
    });

    // Then delete the team (cascade will delete cost tables)
    await prisma.turnkeyTeam.delete({
      where: { id }
    });

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};
