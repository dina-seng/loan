import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config.js';
import { hashPassword } from '../src/auth.js';

const prisma = new PrismaClient();
const DEFAULT_PARTNER_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  // Seeding is a development convenience. Production data is never created or
  // modified by this script unless an operator explicitly opts in.
  if (config.isProduction && process.env.ALLOW_PROD_SEED !== '1') {
    throw new Error(
      'Seeding is disabled in production. Set ALLOW_PROD_SEED=1 only if you intentionally want to create the fallback partner/owner.',
    );
  }

  const username = process.env.SEED_USERNAME || 'dad';
  const password = process.env.SEED_PASSWORD || 'change-me-123';

  // The fallback partner from the migration. Existing records already point here.
  await prisma.partner.upsert({
    where: { id: DEFAULT_PARTNER_ID },
    update: {},
    create: { id: DEFAULT_PARTNER_ID, name: 'អ៊ូដុំ', openingBalance: 0 },
  });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (!existing) {
    await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword(password),
        displayName: 'ប៉ា',
        role: 'OWNER',
      },
    });
    console.log(`Created owner account "${username}". Change the password after first login.`);
  } else {
    // Promote an existing legacy account to owner without touching its password.
    if (existing.role !== 'OWNER') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'OWNER' } });
    }
    console.log(`Owner account "${username}" already exists; no password changes made.`);
  }

  // No fake financial records are ever seeded.
  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
