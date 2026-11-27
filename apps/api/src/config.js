import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Resolve the single root .env file shared by api and web.
dotenv.config({ path: path.resolve(here, '../../../.env') });

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

export const config = {
  nodeEnv,
  isProduction,
  port: num(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET || 'development-only-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || `http://localhost:${num(process.env.PORT, 4000)}`,
  cookieName: 'bl_session',
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
  cookieSameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax'),
  sessionTtlDays: num(process.env.SESSION_TTL_DAYS, 7),
  businessTimeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Phnom_Penh',
  loginMaxAttempts: num(process.env.LOGIN_MAX_ATTEMPTS, 5),
  loginWindowMinutes: num(process.env.LOGIN_WINDOW_MINUTES, 15),
  loginLockMinutes: num(process.env.LOGIN_LOCK_MINUTES, 15),
};

export function assertConfig() {
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    missing.push('SESSION_SECRET (at least 32 characters in production)');
  }
  if (isProduction && !process.env.CLIENT_URL) missing.push('CLIENT_URL');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
