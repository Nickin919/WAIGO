import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔐 Creating admin user...');

    // Hash password (full schema: passwordHash field)
    const passwordHash = await bcrypt.hash('password123', 10);

    // Create admin user (full schema: passwordHash, firstName, lastName, isActive)
    const admin = await prisma.user.create({
      data: {
        email: 'nick@nwvoss.com',
        passwordHash,
        firstName: 'Nick',
        lastName: 'VossAdmin',
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('\n📝 Login Credentials:');
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: password123`);
    console.log(`   Role:     ${admin.role}`);
    console.log(`   Name:     ${admin.firstName} ${admin.lastName}`);
    console.log('\n🚀 You can now login at: http://localhost:5173');
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2002') {
      console.error('❌ User with email nick@nwvoss.com already exists!');
    } else {
      console.error('❌ Failed to create admin user:', err.message ?? error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
