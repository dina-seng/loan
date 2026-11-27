// Apply migrations to the TEST database only.
//
// Loading .env inside Node avoids shell-specific env-var syntax and makes the
// target explicit. This script refuses to run unless TEST_DATABASE_URL names a
// test database, and prints host/database (never the password) before running.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
dotenv.config({ path: path.join(root, '.env') });

const target = process.env.TEST_DATABASE_URL;
if (!target) throw new Error('TEST_DATABASE_URL is not set in .env');
if (!target.includes('test')) throw new Error('TEST_DATABASE_URL must name a test database');

const url = new URL(target);
console.log(`target host=${url.hostname} database=${url.pathname.replace(/^\//, '')} node=${process.env.NODE_ENV || 'unset'}`);

const result = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema=apps/api/prisma/schema.prisma'],
  { cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: target } },
);
process.exitCode = result.status ?? 1;
