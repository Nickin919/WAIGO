/**
 * One-time data migration: update legacy user roles to canonical names.
 * Run after deploying schema with new enum values (DIRECT_USER, BASIC_USER, DISTRIBUTOR_REP).
 *
 *   npx tsx scripts/migrate-roles-to-canonical.ts
 *
 * Maps: TURNKEY → DIRECT_USER, BASIC → BASIC_USER, DISTRIBUTOR → DISTRIBUTOR_REP
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const turnkey = await prisma.user.updateMany({
    where: { role: 'TURNKEY' },
    data: { role: 'DIRECT_USER' },
  });
  const basic = await prisma.user.updateMany({
    where: { role: 'BASIC' },
    data: { role: 'BASIC_USER' },
  });
  const dist = await prisma.user.updateMany({
    where: { role: 'DISTRIBUTOR' },
    data: { role: 'DISTRIBUTOR_REP' },
  });
  console.log('Roles migrated:', { turnkey: turnkey.count, basic: basic.count, distributor: dist.count });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
