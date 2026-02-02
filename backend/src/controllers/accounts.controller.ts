import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { effectiveRole } from '../lib/roles';
import { getSubordinateUserIds } from '../lib/hierarchy';

/**
 * GET /api/accounts – list companies (accounts) the caller can use for assignment
 * Admin: all DISTRIBUTOR and CUSTOMER accounts. RSM/Distributor: accounts in their hierarchy.
 */
export const getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const role = effectiveRole(req.user.role);
    if (!['ADMIN', 'RSM', 'DISTRIBUTOR_REP'].includes(role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const subordinateIds = await getSubordinateUserIds(req.user.id, req.user.role);

    // Admin and RSM see all companies (so they can assign users to any company, including newly created)
    if (role === 'ADMIN' || role === 'RSM') {
      const accounts = await prisma.account.findMany({
        where: { type: { in: ['DISTRIBUTOR', 'CUSTOMER'] } },
        select: {
          id: true,
          name: true,
          type: true,
          _count: { select: { usersAsAccount: true } },
        },
        orderBy: { name: 'asc' },
      });
      res.json(accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, userCount: a._count.usersAsAccount })));
      return;
    }

    // Distributor: only accounts that have at least one user in their hierarchy
    const accounts = await prisma.account.findMany({
      where: {
        type: { in: ['DISTRIBUTOR', 'CUSTOMER'] },
        usersAsAccount: { some: { id: { in: subordinateIds } } },
      },
      select: {
        id: true,
        name: true,
        type: true,
        _count: { select: { usersAsAccount: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, userCount: a._count.usersAsAccount })));
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

/**
 * POST /api/accounts – create a company (Admin/RSM only)
 * Body: { name: string, type: 'DISTRIBUTOR' | 'CUSTOMER' }
 */
export const createAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['ADMIN', 'RSM'].includes(effectiveRole(req.user.role))) {
      res.status(403).json({ error: 'Admin or RSM only' });
      return;
    }

    const { name, type } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!['DISTRIBUTOR', 'CUSTOMER'].includes(type)) {
      res.status(400).json({ error: 'type must be DISTRIBUTOR or CUSTOMER' });
      return;
    }

    const account = await prisma.account.create({
      data: { name: name.trim(), type },
      select: { id: true, name: true, type: true },
    });
    res.status(201).json(account);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
};
