import logger from '../utils/logger.js';
import { getRequestRouteLabel } from './requestContext.js';

export function notFoundHandler(req, res) {
  // Never echo arbitrary URLs, email addresses, query strings or tokens.
  res.status(404).json({ error: 'Route not found.', request_id: req.id || null });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isMulterError = err?.name === 'MulterError' || err?.message === 'Only image files are allowed.';
  const requestedStatus = isMulterError ? 400 : err?.status || 500;
  const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
    ? requestedStatus : 500;
  const message = process.env.NODE_ENV === 'production' && status >= 500
    ? 'Something went wrong on our end. Please try again.'
    : (err?.message || 'Request failed.');

  logger.log(status >= 500 ? 'error' : 'warn', 'http_error', {
    method: req.method,
    route: getRequestRouteLabel(req),
    status,
    requestId: req.id || null,
    errorType: err?.name || 'Error',
  });

  if (res.headersSent) return next(err);
  return res.status(status).json({ error: message, request_id: req.id || null });
}
