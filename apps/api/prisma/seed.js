import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth.js';

const prisma = new PrismaClient();
const DEFAULT_PARTNER_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  const username = process.env.SEED_USERNAME || 'dad';
  const password = process.env.SEED_PASSWORD || 'change-me-123';

  const settings = await prisma.accountSettings.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id: 'main',
      businessName: 'Business Ledger',
      ownerName: 'ប៉ា',
      partnerName: 'អ៊ូដុំ',
      openingBalance: 0n,
      openingDate: new Date('2000-01-01T00:00:00.000Z'),
    },
  });

  // The fallback partner from the migration. Existing records already point here.
  await prisma.partner.upsert({
    where: { id: DEFAULT_PARTNER_ID },
    update: {},
    create: {
      id: DEFAULT_PARTNER_ID,
      name: 'អ៊ូដុំ',
      note: 'ដៃគូដើម',
      openingBalance: settings.openingBalance,
    },
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
    console.log(`Owner account "${username}" already exists; no changes made.`);
  }

  // No fake financial records or product catalog are ever seeded.
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
