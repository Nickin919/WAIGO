import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a demo catalog
  const catalog = await prisma.catalog.upsert({
    where: { id: 'demo-catalog' },
    update: {},
    create: {
      id: 'demo-catalog',
      name: 'WAGO Demo Catalog',
      description: 'Demo product catalog with sample WAGO products',
      isActive: true,
    },
  });

  console.log('✅ Created catalog:', catalog.name);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@wago.com' },
    update: {},
    create: {
      email: 'admin@wago.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      catalogId: catalog.id,
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create demo user
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@demo.com' },
    update: {},
    create: {
      email: 'user@demo.com',
      passwordHash: userPassword,
      firstName: 'Demo',
      lastName: 'User',
      role: 'USER',
      catalogId: catalog.id,
      isActive: true,
    },
  });

  console.log('✅ Created demo user:', user.email);

  // Create distributor user
  const distPassword = await bcrypt.hash('dist123', 10);
  const distributor = await prisma.user.upsert({
    where: { email: 'distributor@demo.com' },
    update: {},
    create: {
      email: 'distributor@demo.com',
      passwordHash: distPassword,
      firstName: 'Distributor',
      lastName: 'Demo',
      role: 'DISTRIBUTOR',
      catalogId: catalog.id,
      distributorMarginPercent: 15.0,
      isActive: true,
    },
  });

  console.log('✅ Created distributor user:', distributor.email);

  // Create top-level categories
  const categories = [
    {
      name: 'Terminal Blocks',
      shortText: 'Connection solutions',
      longText: 'Comprehensive range of terminal blocks for various applications',
      order: 1,
    },
    {
      name: 'Electronics',
      shortText: 'Electronic components',
      longText: 'Power supplies, relays, and electronic modules',
      order: 2,
    },
    {
      name: 'Automation',
      shortText: 'Control systems',
      longText: 'PLCs, I/O systems, and industrial automation solutions',
      order: 3,
    },
    {
      name: 'Tools and Marking',
      shortText: 'Installation tools',
      longText: 'Tools, markers, and accessories for installation',
      order: 4,
    },
  ];

  for (const cat of categories) {
    const category = await prisma.category.create({
      data: {
        catalogId: catalog.id,
        ...cat,
      },
    });
    console.log('✅ Created category:', category.name);

    // Add sample parts to first category
    if (cat.name === 'Terminal Blocks') {
      const parts = [
        {
          partNumber: '2002-1201',
          description: 'Push-in CAGE CLAMP® terminal block; 2.5 mm²; 2-pole',
          minQty: 1,
          packageQty: 50,
          basePrice: 0.85,
        },
        {
          partNumber: '2002-1401',
          description: 'Push-in CAGE CLAMP® terminal block; 2.5 mm²; 4-pole',
          minQty: 1,
          packageQty: 50,
          basePrice: 1.45,
        },
        {
          partNumber: '221-412',
          description: 'LEVER-NUTS® 2 Conductor Compact Splicing Connector',
          minQty: 5,
          packageQty: 100,
          basePrice: 0.35,
        },
      ];

      for (const part of parts) {
        const createdPart = await prisma.part.create({
          data: {
            catalogId: catalog.id,
            categoryId: category.id,
            ...part,
          },
        });
        console.log('  ✅ Created part:', createdPart.partNumber);
      }
    }
  }

  console.log('🎉 Seed completed successfully!');
  console.log('\n📝 Demo Credentials:');
  console.log('   Admin:       admin@wago.com / admin123');
  console.log('   User:        user@demo.com / user123');
  console.log('   Distributor: distributor@demo.com / dist123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
