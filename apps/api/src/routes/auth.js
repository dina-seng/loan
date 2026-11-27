import { Router } from 'express';
import { authRequired, checkLoginRateLimit, createSession, destroySession, validateCredentials, verifyPassword } from '../auth.js';
import { prisma } from '../db.js';
import { AppError, asyncHandler, ok } from '../errors.js';
import { money } from '../money.js';
import { audit } from '../audit.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = validateCredentials(req.body);
  const throttle = checkLoginRateLimit(req, username);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    throttle.fail();
    throw new AppError('INVALID_CREDENTIALS', 401);
  }
  throttle.reset();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, res);
  await audit(user.id, 'LOGIN', 'User', user.id, { metadata: { ip: req.ip || null } });
  ok(res, {
    user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
  });
}));

authRouter.post('/logout', authRequired, asyncHandler(async (req, res) => {
  await destroySession(req, res);
  await audit(req.user.id, 'LOGOUT', 'User', req.user.id);
  ok(res, { loggedOut: true });
}));

authRouter.get('/me', authRequired, asyncHandler(async (req, res) => {
  const settings = await prisma.accountSettings.findUnique({ where: { id: 'main' } });
  ok(res, {
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      role: req.user.role,
    },
    account: settings ? {
      businessName: settings.businessName,
      ownerName: settings.ownerName,
      partnerName: settings.partnerName,
      openingBalance: money(settings.openingBalance),
    } : null,
  });
}));
