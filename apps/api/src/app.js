import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { prisma } from './db.js';
import { errorHandler, ok } from './errors.js';
import { authRouter } from './routes/auth.js';
import { authRequired } from './auth.js';
import { partnerRequired } from './partner.js';
import { partnersRouter } from './routes/partners.js';
import { dashboardRouter } from './routes/dashboard.js';
import { entriesRouter } from './routes/entries.js';
import { reportsRouter } from './routes/reports.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, '../../web/dist');

const defaultCsp = helmet.contentSecurityPolicy.getDefaultDirectives();
const allowedOrigins = config.clientUrl.split(',').map((value) => value.trim()).filter(Boolean);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: config.isProduction ? {
      useDefaults: true,
      directives: {
        ...defaultCsp,
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'", ...allowedOrigins],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  app.use(cors({
    origin(origin, callback) {
      // Same-origin requests (including health checks) have no Origin header.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Partner-Id'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ ok: true, status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, status: 'unhealthy', database: 'disconnected' });
    }
  });

  const api = express.Router();
  api.get('/health', (_req, res) => ok(res, { status: 'ok' }));
  api.use('/auth', authRouter);
  api.use('/partners', partnersRouter);

  // Every financial route is scoped to the selected partner before reaching its router.
  const partnerScoped = ['/dashboard', '/entries', '/reports'];
  api.use(partnerScoped, authRequired, partnerRequired);

  api.use('/dashboard', dashboardRouter);
  api.use('/entries', entriesRouter);
  api.use('/reports', reportsRouter);
  app.use('/api/v1', api);

  app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'រកមិនឃើញសេវាកម្មនេះទេ' } }));

  // When deployed as a single process, serve the built frontend from the same origin.
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist, { index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
