import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { prisma } from './db.js';
import { AppError, asyncHandler, badRequest, unauthorized } from './errors.js';

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === 64 && expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setSessionCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/',
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000,
  });
}

export async function createSession(userId, res, client = prisma) {
  const token = crypto.randomBytes(32).toString('base64url');
  await client.session.create({
    data: {
      userId,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000),
    },
  });
  setSessionCookie(res, token);
  return token;
}

export async function destroySession(req, res, client = prisma) {
  const token = req.cookies?.[config.cookieName];
  if (token) {
    await client.session.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie(config.cookieName, { path: '/', sameSite: config.cookieSameSite, secure: config.cookieSecure });
}

export const authRequired = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[config.cookieName];
  if (!token) throw unauthorized();
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
    throw unauthorized();
  }
  req.user = session.user;
  req.sessionId = session.id;
  next();
});

export function requireOwner(req, _res, next) {
  if (req.user?.role !== 'OWNER') return next(new AppError('FORBIDDEN', 403));
  next();
}

/** Simple in-memory per-IP + username throttling for login attempts. */
const attempts = new Map();

function cleanAttempts(now) {
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now || (entry.lockedUntil && entry.lockedUntil <= now)) attempts.delete(key);
  }
}

export function checkLoginRateLimit(req, username) {
  const now = Date.now();
  cleanAttempts(now);
  const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${String(username).toLowerCase()}`;
  const entry = attempts.get(key) || { count: 0, resetAt: now + config.loginWindowMinutes * 60_000, lockedUntil: 0 };
  if (entry.lockedUntil > now) {
    const seconds = Math.ceil((entry.lockedUntil - now) / 1000);
    throw new AppError('TOO_MANY_ATTEMPTS', 429, { retryAfterSeconds: seconds });
  }
  if (entry.count >= config.loginMaxAttempts) {
    entry.lockedUntil = now + config.loginLockMinutes * 60_000;
    entry.count = 0;
    attempts.set(key, entry);
    throw new AppError('TOO_MANY_ATTEMPTS', 429, { retryAfterSeconds: config.loginLockMinutes * 60 });
  }
  attempts.set(key, entry);
  return {
    fail() {
      entry.count += 1;
      attempts.set(key, entry);
    },
    reset() {
      attempts.delete(key);
    },
  };
}

export function validateCredentials(body) {
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');
  if (!username || !password || username.length > 120 || password.length > 200) {
    throw badRequest('VALIDATION_ERROR', { credentials: 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់' });
  }
  return { username, password };
}
