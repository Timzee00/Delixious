import crypto from 'crypto';
import logger from '../utils/logger.js';

// Do not log arbitrary query strings or dynamic payment/customer identifiers.
// Express sets req.route.path after route matching; that is a safe template.
export function getRequestRouteLabel(req) {
  const template = req.route?.path;
  if (template) return `${req.baseUrl || ''}${template}`;
  // Unknown routes are grouped, not logged with attacker-controlled raw URLs.
  return req.path === '/health' ? '/health' : 'unmatched';
}

export function requestContext(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    const slowThresholdMs = Number(process.env.SLOW_REQUEST_MS) || 1000;
    const level = res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 || durationMs >= slowThresholdMs ? 'warn'
      : 'info';
    logger.log(level, 'http_request', {
      method: req.method,
      route: getRequestRouteLabel(req),
      status: res.statusCode,
      requestId: req.id,
      durationMs,
      slow: durationMs >= slowThresholdMs,
    });
  });
  next();
}
