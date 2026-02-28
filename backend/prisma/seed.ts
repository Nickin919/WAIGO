import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Validate DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  try {
    // Ensure default Master Catalog exists (required for product import)
    let masterCatalog = await prisma.catalog.findFirst({
      where: { name: 'Master Catalog' },
    });
    if (!masterCatalog) {
      masterCatalog = await prisma.catalog.create({
        data: {
          name: 'Master Catalog',
          description: 'Default catalog for product imports. All other catalogs are built from this.',
          isMaster: true,
          isActive: true,
          isPublic: false,
        },
      });
      console.log('✅ Created Master Catalog (MASTER)');
    } else if (!masterCatalog.isMaster) {
      await prisma.catalog.update({
        where: { id: masterCatalog.id },
        data: { isMaster: true, isActive: true },
      });
      console.log('✅ Marked Master Catalog as MASTER');
    } else {
      console.log('⏭️ Master Catalog already exists');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Default Project Book ("WAGO Getting Started")
    // Auto-assigned to every new user on registration so they see content immediately.
    // ─────────────────────────────────────────────────────────────────────────
    let defaultProjectBook = await prisma.catalog.findFirst({
      where: { isDefault: true },
    });

    if (!defaultProjectBook) {
      defaultProjectBook = await prisma.catalog.create({
        data: {
          name: 'WAGO Getting Started',
          description: 'Your starter project book. Contains introductory WAGO products curated for new users.',
          isDefault: true,
          isActive: true,
          isPublic: false,
        },
      });
      console.log('✅ Created Default Project Book: WAGO Getting Started');
    } else {
      console.log('⏭️ Default Project Book already exists');
    }

    // Find the seed part: search by $0.01 price OR description containing "Default item"
    const seedPart = await prisma.part.findFirst({
      where: {
        OR: [
          { basePrice: 0.01 },
          { description: { contains: 'Default item', mode: 'insensitive' } },
          { partNumber: { contains: 'WAGO-Hist', mode: 'insensitive' } },
        ],
      },
      select: { id: true, gridLevelNumber: true, gridSublevelNumber: true },
    });

    if (seedPart) {
      // 1. Set grid metadata (Level 1 / Sublevel 1 = first cell in Quick Grid)
      if (!seedPart.gridLevelNumber || !seedPart.gridSublevelNumber) {
        await prisma.part.update({
          where: { id: seedPart.id },
          data: { gridLevelNumber: 1, gridSublevelNumber: 1, gridLevelName: 'Level 1', gridSublevelName: '001' },
        });
        console.log('✅ Set grid metadata on seed part (Level 1 / Sublevel 1)');
      }

      // 2. Link the default project book to the seed part via CatalogItem
      const existingItem = await prisma.catalogItem.findFirst({
        where: { catalogId: defaultProjectBook.id, productId: seedPart.id },
      });
      if (!existingItem) {
        await prisma.catalogItem.create({
          data: { catalogId: defaultProjectBook.id, productId: seedPart.id },
        });
        console.log('✅ Linked seed part to Default Project Book');
      }

      // 3. Link an existing APPROVED video to the seed part (if not already linked)
      const existingVideo = await prisma.video.findFirst({ where: { partId: seedPart.id, status: 'APPROVED' } });
      if (!existingVideo) {
        const unlinkedVideo = await prisma.video.findFirst({ where: { partId: null, status: 'APPROVED' } });
        if (unlinkedVideo) {
          await prisma.video.update({ where: { id: unlinkedVideo.id }, data: { partId: seedPart.id } });
          console.log('✅ Linked approved video to seed part');
        }
      }

      // 4. Link an existing literature item to the seed part (if not already linked)
      const existingLitLink = await prisma.literaturePart.findFirst({ where: { partId: seedPart.id } });
      if (!existingLitLink) {
        const literature = await prisma.literature.findFirst({
          where: { parts: { none: { partId: seedPart.id } } },
        });
        if (literature) {
          await prisma.literaturePart.create({ data: { literatureId: literature.id, partId: seedPart.id } });
          console.log('✅ Linked literature to seed part');
        }
      }
    } else {
      console.log('⚠️  Seed part not found (no part with $0.01 price in Master Catalog). Skipping part wiring.');
    }

    // Backfill: ensure ALL non-FREE users have the default project book assigned and set as primary.
    // This runs safely for users who already have other assignments (adds the default book without removing others).
    const allNonFreeUsers = await prisma.user.findMany({
      where: { role: { notIn: ['FREE'] } },
      select: { id: true },
    });
    let backfillCount = 0;
    for (const u of allNonFreeUsers) {
      // Upsert the default project book assignment (safe if already exists)
      await prisma.catalogAssignment.upsert({
        where: { catalogId_userId: { catalogId: defaultProjectBook.id, userId: u.id } },
        create: { catalogId: defaultProjectBook.id, userId: u.id, isPrimary: true, assignedById: u.id },
        update: { isPrimary: true },
      });
      // Clear isPrimary on all other assignments for this user
      await prisma.catalogAssignment.updateMany({
        where: { userId: u.id, catalogId: { not: defaultProjectBook.id } },
        data: { isPrimary: false },
      });
      // Set user.catalogId to the default project book
      await prisma.user.update({ where: { id: u.id }, data: { catalogId: defaultProjectBook.id } });
      backfillCount++;
    }
    if (backfillCount > 0) {
      console.log(`✅ Backfilled/updated ${backfillCount} user(s): Default Project Book set as primary`);
    }

    // Literature zip milestone (bytes; default 15MB)
    const zipKey = 'literature_zip_milestone';
    const existingZip = await prisma.settings.findUnique({ where: { key: zipKey } });
    if (!existingZip) {
      await prisma.settings.create({
        data: { key: zipKey, value: '15728640', description: 'Bytes threshold for zipping literature pack (15MB)' },
      });
      console.log('✅ Created settings: literature_zip_milestone');
    }

    // Create demo catalog (idempotent: use upsert or skip if exists)
    let catalog = await prisma.catalog.findFirst({
      where: { name: 'WAGO Demo Catalog' }
    });
    if (!catalog) {
      catalog = await prisma.catalog.create({
        data: {
          id: 'demo-catalog',
          name: 'WAGO Demo Catalog',
          description: 'Demo product catalog with sample WAGO products',
          isActive: true,
          isPublic: true,
        },
      });
      console.log('✅ Created catalog:', catalog.name);
    } else {
      console.log('⏭️ Catalog already exists:', catalog.name);
    }

    // Seed users (skip if already exist)
    const demoUsers = [
      { email: 'admin@wago.com', password: 'admin123', firstName: 'Admin', lastName: 'User', role: 'ADMIN' as const },
      { email: 'user@demo.com', password: 'user123', firstName: 'Demo', lastName: 'User', role: 'BASIC' as const },
      { email: 'distributor@demo.com', password: 'dist123', firstName: 'Distributor', lastName: 'Demo', role: 'DISTRIBUTOR' as const },
      { email: 'turnkey@demo.com', password: 'turnkey123', firstName: 'TurnKey', lastName: 'User', role: 'TURNKEY' as const },
      { email: 'rsm@wago.com', password: 'rsm123', firstName: 'Regional', lastName: 'Manager', role: 'RSM' as const },
    ];

    let adminId: string | null = null;
    for (const u of demoUsers) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (!existing) {
        const hash = await bcrypt.hash(u.password, 10);
        const user = await prisma.user.create({
          data: {
            email: u.email,
            passwordHash: hash,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            catalogId: catalog.id,
            isActive: true,
          },
        });
        if (u.role === 'ADMIN') adminId = user.id;
        console.log(`✅ Created ${u.role} user:`, user.email);
      } else {
        if (u.role === 'ADMIN') adminId = existing.id;
        console.log(`⏭️ User already exists:`, u.email);
      }
    }

    // Create TurnKey team (requires admin)
    if (adminId) {
      let turnkeyTeam = await prisma.turnkeyTeam.findFirst({
        where: { name: 'Demo Construction Team' }
      });
      if (!turnkeyTeam) {
        turnkeyTeam = await prisma.turnkeyTeam.create({
          data: {
            name: 'Demo Construction Team',
            description: 'Sample TurnKey team for demonstration',
            createdById: adminId,
          },
        });
        console.log('✅ Created TurnKey team:', turnkeyTeam.name);

        // Assign turnkey user to team
        const turnkeyUser = await prisma.user.findUnique({
          where: { email: 'turnkey@demo.com' }
        });
        if (turnkeyUser) {
          await prisma.user.update({
            where: { id: turnkeyUser.id },
            data: { turnkeyTeamId: turnkeyTeam.id }
          });
        }
      } else {
        console.log('⏭️ TurnKey team already exists');
      }
    }

    // Create categories and parts (idempotent)
    let terminalCategory = await prisma.category.findFirst({
      where: { catalogId: catalog.id, name: 'Terminal Blocks' }
    });
    if (!terminalCategory) {
      terminalCategory = await prisma.category.create({
        data: {
          catalogId: catalog.id,
          name: 'Terminal Blocks',
          shortText: 'Connection solutions',
          longText: 'Comprehensive range of terminal blocks for various applications',
          order: 1,
        },
      });
      console.log('✅ Created category:', terminalCategory.name);
    }

    const sampleParts = [
      { partNumber: '2002-1201', series: '2002', description: 'Push-in CAGE CLAMP® Terminal Block, 2.5 mm², 2-pole', englishDescription: 'Push-in CAGE CLAMP Terminal Block 2.5mm 2-pole', basePrice: 0.85, listPricePer100: 75.00, minQty: 1, packageQty: 50 },
      { partNumber: '221-412', series: '221', description: 'LEVER-NUTS® 2 Conductor Compact Splicing Connector', englishDescription: 'LEVER-NUTS 2 Conductor Compact Splicing Connector', basePrice: 0.35, listPricePer100: 28.00, minQty: 5, packageQty: 100 },
      { partNumber: '750-504', series: '750', description: 'I/O System 750 Digital Input Module, 4-channel', englishDescription: 'I/O System 750 Digital Input 4-channel', basePrice: 45.50, listPricePer100: 4050.00, minQty: 1, packageQty: 1 },
    ];

    for (const p of sampleParts) {
      const existing = await prisma.part.findFirst({
        where: { catalogId: catalog.id, partNumber: p.partNumber }
      });
      if (!existing) {
        await prisma.part.create({
          data: {
            catalogId: catalog.id,
            categoryId: terminalCategory.id,
            partNumber: p.partNumber,
            series: p.series,
            description: p.description,
            englishDescription: p.englishDescription,
            basePrice: p.basePrice,
            listPricePer100: p.listPricePer100,
            minQty: p.minQty,
            packageQty: p.packageQty,
            active: true,
          },
        });
      }
    }
    console.log('✅ Created/verified sample parts');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📝 Demo Credentials:');
    console.log('   Admin:       admin@wago.com / admin123');
    console.log('   BASIC User:  user@demo.com / user123');
    console.log('   TurnKey:     turnkey@demo.com / turnkey123');
    console.log('   Distributor: distributor@demo.com / dist123');
    console.log('   RSM:         rsm@wago.com / rsm123');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
