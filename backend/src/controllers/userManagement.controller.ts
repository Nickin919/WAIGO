import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { effectiveRole, isInternal } from '../lib/roles';
import { getSubordinateUserIds } from '../lib/hierarchy';

/**
 * Get users based on current user's role and permissions
 */
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { role, search, assignedOnly } = req.query;
    let where: any = {};

    // Filter based on user role (effective role supports legacy names)
    const userRole = effectiveRole(req.user.role);
    switch (userRole) {
      case 'ADMIN':
        // Admin sees all users
        if (role) where.role = role;
        break;

      case 'RSM':
        // RSM sees their assigned distributors and all users under them
        where.OR = [
          { assignedToRsmId: req.user.id }, // Distributors assigned to this RSM
          { assignedToDistributor: { assignedToRsmId: req.user.id } } // Users under those distributors
        ];
        break;

      case 'DISTRIBUTOR_REP':
        // Distributor sees only their assigned users
        where.assignedToDistributorId = req.user.id;
        break;

      default:
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
    }

    // Search filter
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { companyName: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        role: true,
        isActive: true,
        accountId: true,
        assignedToDistributorId: true,
        assignedToRsmId: true,
        createdAt: true,
        account: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        assignedToDistributor: {
          select: {
            id: true,
            email: true,
            companyName: true
          }
        },
        assignedToRsm: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Assign user to distributor (RSM or ADMIN only)
 */
export const assignUserToDistributor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isInternal(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { userId, distributorId } = req.body;

    if (!userId || !distributorId) {
      res.status(400).json({ error: 'userId and distributorId are required' });
      return;
    }

    // Verify distributor exists and is a DISTRIBUTOR role
    const distributor = await prisma.user.findUnique({
      where: { id: distributorId },
      select: { role: true, assignedToRsmId: true }
    });

    if (!distributor || effectiveRole(distributor.role) !== 'DISTRIBUTOR_REP') {
      res.status(400).json({ error: 'Invalid distributor' });
      return;
    }

    // RSM can only assign to their own distributors
    if (effectiveRole(req.user.role) === 'RSM' && distributor.assignedToRsmId !== req.user.id) {
      res.status(403).json({ error: 'Cannot assign to distributors not in your region' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { assignedToDistributorId: distributorId }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Assign user error:', error);
    res.status(500).json({ error: 'Failed to assign user' });
  }
};

/**
 * Assign distributor to RSM (ADMIN only)
 */
export const assignDistributorToRsm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || effectiveRole(req.user.role) !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { distributorId, rsmId } = req.body;

    if (!distributorId || !rsmId) {
      res.status(400).json({ error: 'distributorId and rsmId are required' });
      return;
    }

    // Verify RSM exists
    const rsm = await prisma.user.findUnique({
      where: { id: rsmId },
      select: { role: true }
    });

    if (!rsm || rsm.role !== 'RSM') {
      res.status(400).json({ error: 'Invalid RSM' });
      return;
    }

    const updatedDistributor = await prisma.user.update({
      where: { id: distributorId },
      data: { assignedToRsmId: rsmId }
    });

    res.json(updatedDistributor);
  } catch (error) {
    console.error('Assign distributor error:', error);
    res.status(500).json({ error: 'Failed to assign distributor' });
  }
};

/**
 * Assign user(s) to a company (account). Admin/RSM: any user in hierarchy; Distributor: only their managed users.
 * Body: { userId: string, accountId: string | null } or { userIds: string[], accountId: string | null }
 */
export const assignUserToAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['ADMIN', 'RSM', 'DISTRIBUTOR_REP'].includes(effectiveRole(req.user.role))) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { userId, userIds, accountId } = req.body;
    const ids: string[] = userId ? [userId] : Array.isArray(userIds) ? userIds : [];
    if (ids.length === 0) {
      res.status(400).json({ error: 'userId or userIds array is required' });
      return;
    }

    if (accountId !== undefined && accountId !== null) {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { id: true, type: true },
      });
      if (!account) {
        res.status(400).json({ error: 'Invalid account' });
        return;
      }
    }

    const subordinateIds = await getSubordinateUserIds(req.user!.id, req.user!.role);
    const allowed = ids.every((id) => subordinateIds.includes(id));
    if (!allowed) {
      res.status(403).json({ error: 'Cannot assign one or more users outside your hierarchy' });
      return;
    }

    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { accountId: accountId || null },
    });

    const updated = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, accountId: true, account: { select: { id: true, name: true, type: true } } },
    });
    res.json(updated);
  } catch (error) {
    console.error('Assign to account error:', error);
    res.status(500).json({ error: 'Failed to assign to account' });
  }
};

/**
 * Get user hierarchy (who manages whom)
 */
export const getUserHierarchy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userId = req.params.userId || req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        managedUsers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        managedByRsm: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        assignedToDistributor: {
          select: {
            id: true,
            email: true,
            companyName: true,
            role: true
          }
        },
        assignedToRsm: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      manages: user.managedUsers,
      managedBy: user.assignedToDistributor || user.assignedToRsm,
      distributorsManaged: user.managedByRsm
    });
  } catch (error) {
    console.error('Get hierarchy error:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy' });
  }
};

/**
 * Update user role (ADMIN only)
 */
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || effectiveRole(req.user.role) !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['FREE', 'BASIC', 'TURNKEY', 'DISTRIBUTOR', 'RSM', 'ADMIN'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

/**
 * Get activity for managed users (Distributor, RSM, Admin)
 */
export const getManagedUsersActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['DISTRIBUTOR_REP', 'RSM', 'ADMIN'].includes(effectiveRole(req.user.role))) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    let userIds: string[] = [];

    if (effectiveRole(req.user.role) === 'ADMIN') {
      // Admin sees all activity
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      userIds = allUsers.map(u => u.id);
    } else if (effectiveRole(req.user.role) === 'RSM') {
      // RSM sees their distributors and all users under them
      const distributors = await prisma.user.findMany({
        where: { assignedToRsmId: req.user.id },
        select: { id: true }
      });
      const distributorIds = distributors.map(d => d.id);
      
      const users = await prisma.user.findMany({
        where: { assignedToDistributorId: { in: distributorIds } },
        select: { id: true }
      });
      
      userIds = [...distributorIds, ...users.map(u => u.id)];
    } else if (effectiveRole(req.user.role) === 'DISTRIBUTOR_REP') {
      // Distributor sees their assigned users
      const users = await prisma.user.findMany({
        where: { assignedToDistributorId: req.user.id },
        select: { id: true }
      });
      userIds = users.map(u => u.id);
    }

    // Get recent activity
    const [projects, quotes, recentLogins] = await Promise.all([
      prisma.project.findMany({
        where: { userId: { in: userIds } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
      }),
      prisma.quote.findMany({
        where: { userId: { in: userIds } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
      }),
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          lastActiveAt: true
        },
        orderBy: { lastActiveAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      recentProjects: projects,
      recentQuotes: quotes,
      recentLogins: recentLogins
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
};
