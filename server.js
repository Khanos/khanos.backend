import { loadConfig } from './config.js';
import { start } from './lifecycle.js';
import { createLogger } from './logger.js';

// Explicit production entry point. Import app.js for tests; server.js boots the process.
const log = createLogger();
try {
  await start({ config: loadConfig(), log });
} catch {
  log({ event: 'bootstrap', outcome: 'failed' });
  process.exit(1); // A failed bounded cleanup must not leave a half-started process alive.
}
