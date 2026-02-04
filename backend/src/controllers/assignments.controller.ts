import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getSubordinateUserIds } from '../lib/hierarchy';
import { canManageHierarchy, effectiveRole } from '../lib/roles';

/**
 * GET /api/assignments/tree – hierarchical users visible to caller (ADMIN/RSM/DISTRIBUTOR)
 */
export const getTree = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const role = req.user.role;
    if (!canManageHierarchy(role)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const subordinateIds = await getSubordinateUserIds(req.user.id, role);
    const effRole = effectiveRole(role);

    if (effRole === 'ADMIN') {
      const rsms = await prisma.user.findMany({
        where: { role: 'RSM', id: { in: subordinateIds } },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      const distributors = await prisma.user.findMany({
        where: { role: { in: ['DISTRIBUTOR', 'DISTRIBUTOR_REP'] }, id: { in: subordinateIds } },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, assignedToRsmId: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      const basicTurnkey = await prisma.user.findMany({
        where: { role: { in: ['BASIC', 'BASIC_USER', 'TURNKEY', 'DIRECT_USER'] }, id: { in: subordinateIds } },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, assignedToDistributorId: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      res.json({
        rsms: rsms.map((r) => ({ ...r, children: distributors.filter((d) => d.assignedToRsmId === r.id) })),
        distributors: distributors.map((d) => ({
          ...d,
          children: basicTurnkey.filter((u) => u.assignedToDistributorId === d.id),
        })),
        users: basicTurnkey,
      });
      return;
    }

    if (effRole === 'RSM') {
      const distributors = await prisma.user.findMany({
        where: { role: { in: ['DISTRIBUTOR', 'DISTRIBUTOR_REP'] }, assignedToRsmId: req.user.id },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      const basicTurnkey = await prisma.user.findMany({
        where: {
          role: { in: ['BASIC', 'BASIC_USER', 'TURNKEY', 'DIRECT_USER'] },
          assignedToDistributorId: { in: distributors.map((d) => d.id) },
        },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, assignedToDistributorId: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      res.json({
        distributors: distributors.map((d) => ({
          ...d,
          children: basicTurnkey.filter((u) => u.assignedToDistributorId === d.id),
        })),
        users: basicTurnkey,
      });
      return;
    }

    // DISTRIBUTOR
    const users = await prisma.user.findMany({
      where: { assignedToDistributorId: req.user.id },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    res.json({ users });
    return;
  } catch (error) {
    console.error('Assignments tree error:', error);
    res.status(500).json({ error: 'Failed to load hierarchy' });
  }
};

/**
 * GET /api/assignments/users – flat list for table (search, pagination)
 */
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const role = req.user.role;
    if (!canManageHierarchy(role)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const subordinateIds = await getSubordinateUserIds(req.user.id, role);
    const search = (req.query.search as string)?.trim().toLowerCase();
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(10, parseInt(String(req.query.limit), 10) || 20));
    const skip = (page - 1) * limit;

    const where: any = { id: { in: subordinateIds }, role: { not: 'FREE' } };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          catalogId: true,
          accountId: true,
          assignedToDistributorId: true,
          assignedToRsmId: true,
          catalog: { select: { id: true, name: true } },
          account: { select: { id: true, name: true, type: true } },
          assignedToDistributor: { select: { id: true, email: true, companyName: true, firstName: true, lastName: true } },
          assignedToRsm: { select: { id: true, email: true, firstName: true, lastName: true } },
          catalogAssignments: {
            include: { catalog: { select: { id: true, name: true } } },
          },
          priceContractAssignments: {
            include: { contract: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        primaryCatalog: u.catalogAssignments.find((a) => a.isPrimary)?.catalog ?? (u.catalog ? { id: u.catalog.id, name: u.catalog.name } : null),
        assignedCatalogs: u.catalogAssignments.map((a) => a.catalog),
        assignedContracts: u.priceContractAssignments.map((a) => a.contract),
        account: u.account,
        assignedToDistributor: u.assignedToDistributor,
        assignedToRsm: u.assignedToRsm,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Assignments users error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
};

/**
 * GET /api/assignments/users/:userId – single user assignment data (for account detail page)
 */
export const getAssignmentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const role = req.user.role;
    if (!canManageHierarchy(role)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const subordinateIds = await getSubordinateUserIds(req.user.id, role);
    const { userId } = req.params;
    if (!subordinateIds.includes(userId)) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        catalogId: true,
        accountId: true,
        assignedToDistributorId: true,
        assignedToRsmId: true,
        catalog: { select: { id: true, name: true } },
        account: { select: { id: true, name: true, type: true } },
        assignedToDistributor: { select: { id: true, email: true, companyName: true, firstName: true, lastName: true } },
        assignedToRsm: { select: { id: true, email: true, firstName: true, lastName: true } },
        catalogAssignments: {
          include: { catalog: { select: { id: true, name: true } } },
        },
        priceContractAssignments: {
          include: { contract: { select: { id: true, name: true } } },
        },
      },
    });
    if (!u) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      primaryCatalog: u.catalogAssignments.find((a) => a.isPrimary)?.catalog ?? (u.catalog ? { id: u.catalog.id, name: u.catalog.name } : null),
      assignedCatalogs: u.catalogAssignments.map((a) => a.catalog),
      assignedContracts: u.priceContractAssignments.map((a) => a.contract),
      account: u.account,
      assignedToDistributor: u.assignedToDistributor,
      assignedToRsm: u.assignedToRsm,
    });
  } catch (error) {
    console.error('Get assignment user error:', error);
    res.status(500).json({ error: 'Failed to load user' });
  }
};

/**
 * POST /api/assignments/catalogs – assign catalogs (bulk/single), set primary
 * Body: { userId?: string, userIds?: string[], catalogIds: string[], primaryCatalogId?: string }
 */
export const assignCatalogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const role = req.user.role;
    if (!canManageHierarchy(role)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { userId, userIds, catalogIds, primaryCatalogId } = req.body;
    const targetIds = userIds && Array.isArray(userIds) ? userIds : userId ? [userId] : [];
    if (targetIds.length === 0 || !Array.isArray(catalogIds) || catalogIds.length === 0) {
      res.status(400).json({ error: 'userIds or userId and catalogIds required' });
      return;
    }

    const subordinateIds = await getSubordinateUserIds(req.user.id, role);
    const invalid = targetIds.filter((id: string) => !subordinateIds.includes(id));
    if (invalid.length > 0) {
      res.status(403).json({ error: 'Cannot assign for users outside your scope' });
      return;
    }

    for (const uid of targetIds) {
      await prisma.$transaction(async (tx) => {
        await tx.catalogAssignment.deleteMany({ where: { userId: uid } });
        const primaryId = primaryCatalogId && catalogIds.includes(primaryCatalogId) ? primaryCatalogId : catalogIds[0];
        for (const cid of catalogIds) {
          await tx.catalogAssignment.create({
            data: {
              userId: uid,
              catalogId: cid,
              isPrimary: cid === primaryId,
              assignedById: req.user!.id,
            },
          });
        }
        await tx.user.update({
          where: { id: uid },
          data: { catalogId: primaryId },
        });
      });
    }

    res.json({ message: 'Catalogs assigned' });
  } catch (error) {
    console.error('Assign catalogs error:', error);
    res.status(500).json({ error: 'Failed to assign catalogs' });
  }
};

/**
 * POST /api/assignments/contracts – assign price contracts (bulk/single)
 * Body: { userId?: string, userIds?: string[], contractIds: string[] }
 */
export const assignContracts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const role = req.user.role;
    if (!canManageHierarchy(role)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { userId, userIds, contractIds } = req.body;
    const targetIds = userIds && Array.isArray(userIds) ? userIds : userId ? [userId] : [];
    if (targetIds.length === 0) {
      res.status(400).json({ error: 'Provide userId or userIds (at least one user)' });
      return;
    }
    if (!Array.isArray(contractIds) || contractIds.length === 0) {
      res.status(400).json({ error: 'At least one contract is required (contractIds)' });
      return;
    }

    const subordinateIds = await getSubordinateUserIds(req.user.id, role);
    const invalid = targetIds.filter((id: string) => !subordinateIds.includes(id));
    if (invalid.length > 0) {
      res.status(403).json({ error: 'Cannot assign for users outside your scope' });
      return;
    }

    for (const uid of targetIds) {
      for (const cid of contractIds) {
        await prisma.userPriceContractAssignment.upsert({
          where: {
            userId_contractId: { userId: uid, contractId: cid },
          },
          create: {
            userId: uid,
            contractId: cid,
            assignedById: req.user!.id,
          },
          update: {},
        });
      }
    }

    res.json({ message: 'Price contracts assigned' });
  } catch (error) {
    console.error('Assign contracts error:', error);
    res.status(500).json({ error: 'Failed to assign contracts' });
  }
};

/**
 * GET /api/assignments/me – current user's catalog and price contract assignments (for proposal wizard)
 */
export const getMyAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const userId = req.user.id;

    const [catalogAssignments, priceContractAssignments, user] = await Promise.all([
      prisma.catalogAssignment.findMany({
        where: { userId },
        include: { catalog: { select: { id: true, name: true, _count: { select: { parts: true, categories: true } } } } },
      }),
      prisma.userPriceContractAssignment.findMany({
        where: { userId },
        include: { contract: { select: { id: true, name: true, validFrom: true, validTo: true } } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { catalogId: true },
      }),
    ]);

    let catalogsPayload = catalogAssignments.map((a) => ({
      ...a.catalog,
      isPrimary: a.isPrimary,
    }));
    let primaryCatalogId: string | null = catalogAssignments.find((a) => a.isPrimary)?.catalogId ?? (user?.catalogId ? catalogAssignments.find((a) => a.catalogId === user.catalogId)?.catalogId : null) ?? user?.catalogId ?? null;

    // New users with no catalog assignments see only the MASTER catalog until catalogs are assigned
    if (catalogsPayload.length === 0) {
      const masterCatalog = await prisma.catalog.findFirst({
        where: { isMaster: true, isActive: true },
        select: { id: true, name: true, _count: { select: { parts: true, categories: true } } },
      });
      if (masterCatalog) {
        catalogsPayload = [{ ...masterCatalog, isPrimary: true }];
        primaryCatalogId = masterCatalog.id;
      }
    }

    res.json({
      catalogs: catalogsPayload,
      primaryCatalogId,
      priceContracts: priceContractAssignments.map((a) => a.contract),
    });
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Failed to load assignments' });
  }
};
