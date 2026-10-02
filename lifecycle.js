import http from 'node:http';
import { createApp } from './app.js';
import mongoDB from './db.js';
import { createLogger } from './logger.js';

/** Await persistence/index readiness before opening a socket. */
export async function start({ config, database = mongoDB, log = createLogger(),
  appFactory = createApp, serverFactory = http.createServer, signals = process }) {
  let accepting = false;
  let server;
  let shutdownPromise;
  let startupPhase = 'database';
  async function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    accepting = false;
    shutdownPromise = (async () => {
      signals.removeListener('SIGINT', onSignal);
      signals.removeListener('SIGTERM', onSignal);
      const drain = server ? new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeIdleConnections();
      }) : Promise.resolve();
      let timer;
      const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          if (server) server.closeAllConnections();
          reject(new Error('Shutdown deadline exceeded'));
        }, config.shutdownTimeoutMs);
      });
      try {
        // Disconnect is part of the same shutdown budget, including failure paths.
        await Promise.race([drain.finally(() => database.disconnect()), deadline]);
        log({ event: 'shutdown', outcome: 'ok' });
      } catch (error) {
        log({ event: 'shutdown', outcome: 'failed' });
        throw error;
      } finally { clearTimeout(timer); }
    })();
    return shutdownPromise;
  }
  function onSignal() {
    shutdown().then(() => { signals.exitCode = 0; }, () => { signals.exit(1); });
  }
  try {
    // TEST does not open a listener: tests construct the app explicitly instead.
    if (config.test) throw new Error('TEST mode cannot start a server');
    await database.connect(config);
    startupPhase = 'listener';
    const app = appFactory({ config, log, isReady: () => accepting && database.isReady() });
    server = serverFactory(app);
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.bindHost, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    server.on('error', () => {
      log({ event: 'listener', outcome: 'failed' });
      shutdown().then(() => { signals.exitCode = 1; }, () => { signals.exit(1); });
    });
    accepting = true;
    signals.once('SIGINT', onSignal);
    signals.once('SIGTERM', onSignal);
    log({ event: 'startup', outcome: 'ready' });
    return { app, server, shutdown };
  } catch (error) {
    log({ event: 'startup', outcome: 'failed',
      code: startupPhase === 'database' ? (error?.code === 'URL_INDEXES_MISSING' ? 'URL_INDEXES_MISSING' : 'DATABASE_STARTUP_FAILED') : 'LISTENER_STARTUP_FAILED' });
    await shutdown();
    throw error;
  }
}
