import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // eslint-disable-next-line no-console
  console.info('Seeding database...');

  // Create admin user (override defaults via ADMIN_EMAIL / ADMIN_SEED_PASSWORD env vars)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@socialbro.com';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      'ADMIN_SEED_PASSWORD environment variable is required to seed the admin user',
    );
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    // eslint-disable-next-line no-console
    console.info('Admin user already exists, skipping...');
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin',
        inviteToken: null,
        createdAt: new Date(),
      },
    });

    // eslint-disable-next-line no-console
    console.info(`Created admin user: ${adminEmail}`);
  }

  // eslint-disable-next-line no-console
  console.info('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
