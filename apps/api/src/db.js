import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

export const prisma = new PrismaClient({
  log: config.nodeEnv === 'test' ? [] : config.isProduction ? ['error'] : ['error', 'warn'],
});

export async function disconnectDb() {
  await prisma.$disconnect();
}
