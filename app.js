import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ROOT } from './config.js';
import { createLogger, requestContext } from './logger.js';
import createRouter from './api/routes/index.js';
import MainController from './api/controllers/MainController.js';
import errorHandler from './api/middlewares/errorHandler.js';
import ApiError from './api/utils/ApiError.js';
import { createUrlService } from './api/services/UrlShortenerService.js';
import { createGithubService } from './api/services/GithubService.js';

/** No listen, dotenv or database connection side effects. */
export function createApp({ config, log = createLogger(), isReady = () => false, urlService, githubService }) {
  const app = express();
  app.disable('x-powered-by');
  app.locals.log = log;
  app.set('views', path.join(ROOT, 'views'));
  app.set('view engine', 'ejs');
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    const controller = new AbortController();
    req.dependencySignal = controller.signal;
    const started = performance.now();
    res.on('close', () => controller.abort());
    res.on('finish', () => log({ event: 'request', requestId: req.requestId,
      method: req.method, route: req.logRoute || (req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched'),
      status: res.statusCode, durationMs: Math.round(performance.now() - started) }));
    requestContext.run(req.requestId, next);
  });
  app.use(helmet()); // Documentation uses only local external scripts.
  app.use(cors());
  app.use(compression());
  // Health endpoints must remain reachable during draining and rate-limit incidents.
  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });
  if (!config.test) app.use(rateLimit({ windowMs: config.rateLimitWindowMs, limit: config.rateLimitMax,
    standardHeaders: true, legacyHeaders: false,
    handler(req, res, next) { next(new ApiError(429, 'RATE_LIMITED', 'Too many requests')); },
  }));
  // Return retirement responses without parsing a legacy request body.
  app.use('/api/gemini', (req, res) => {
    req.logRoute = '/api/gemini/*';
    res.status(410).json({ error: 'Google Gemini API has been retired.' });
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 100 }));
  app.use(express.static(path.join(ROOT, 'public')));
  app.use('/api', createRouter({
    ownerToken: config.ownerToken,
    urlService: urlService || createUrlService({ log }),
    githubService: githubService || createGithubService({ baseUrl: config.githubBase, timeoutMs: config.githubTimeoutMs, log }),
  }));
  app.get('/', MainController.render);
  app.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Not found')));
  app.use(errorHandler);
  return app;
}
