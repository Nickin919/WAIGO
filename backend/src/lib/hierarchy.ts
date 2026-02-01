import { prisma } from './prisma';

/**
 * Get subordinate user IDs based on role hierarchy.
 * Used for scoping: catalogs, quotes, assignments, price contracts.
 */
export async function getSubordinateUserIds(userId: string, userRole: string): Promise<string[]> {
  const ids = [userId];

  switch (userRole) {
    case 'ADMIN': {
      const all = await prisma.user.findMany({ select: { id: true } });
      return all.map((u) => u.id);
    }
    case 'RSM': {
      const distributors = await prisma.user.findMany({
        where: { assignedToRsmId: userId },
        select: { id: true },
      });
      const distIds = distributors.map((d) => d.id);
      const under = await prisma.user.findMany({
        where: { assignedToDistributorId: { in: distIds } },
        select: { id: true },
      });
      return [...ids, ...distIds, ...under.map((u) => u.id)];
    }
    case 'DISTRIBUTOR': {
      const assigned = await prisma.user.findMany({
        where: { assignedToDistributorId: userId },
        select: { id: true },
      });
      return [...ids, ...assigned.map((u) => u.id)];
    }
    case 'TURNKEY': {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { turnkeyTeamId: true },
      });
      if (u?.turnkeyTeamId) {
        const team = await prisma.user.findMany({
          where: { turnkeyTeamId: u.turnkeyTeamId },
          select: { id: true },
        });
        return team.map((t) => t.id);
      }
      return ids;
    }
    default:
      return ids;
  }
}
