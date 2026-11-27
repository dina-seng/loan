import { createApp } from './app.js';
import { assertConfig, config } from './config.js';
import { disconnectDb } from './db.js';

assertConfig();
const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[business-ledger] API listening on port ${config.port} (${config.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`[business-ledger] ${signal} received, shutting down`);
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
