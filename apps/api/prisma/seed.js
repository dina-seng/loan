import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth.js';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_USERNAME || 'dad';
  const password = process.env.SEED_PASSWORD || 'change-me-123';

  await prisma.accountSettings.upsert({
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

  // A tiny product catalog is helpful for a fresh local install.
  // No financial transactions are ever seeded.
  if (process.env.NODE_ENV !== 'production') {
    const sample = [
      { name: 'ស៊ីម៉ង់', unit: 'កាប់', unitPrice: 0n },
      { name: 'ដែក', unit: 'គីឡូក្រាម', unitPrice: 0n },
      { name: 'ឈើ', unit: 'បន្ទះ', unitPrice: 0n },
    ];
    for (const item of sample) {
      const found = await prisma.product.findFirst({ where: { name: item.name } });
      if (!found) await prisma.product.create({ data: item });
    }
  }

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
