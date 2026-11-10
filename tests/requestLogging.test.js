import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/utils/logger.js', () => ({ default: { log: vi.fn() } }));

import logger from '../src/utils/logger.js';
import { getRequestRouteLabel } from '../src/middleware/requestContext.js';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler.js';

function response() {
  return { headersSent: false, status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

describe('API telemetry privacy and error traceability', () => {
  it('logs route templates instead of a private payment reference or query string', () => {
    const label = getRequestRouteLabel({
      route: { path: '/payments/verify/:reference' },
      baseUrl: '/api',
      path: '/api/payments/verify/private-ref',
      originalUrl: '/api/payments/verify/private-ref?token=secret',
    });
    expect(label).toBe('/api/payments/verify/:reference');
    expect(label).not.toContain('private-ref');
    expect(label).not.toContain('secret');
  });

  it('does not echo invalid paths or token-containing query strings', () => {
    const res = response();
    notFoundHandler({ method: 'GET', originalUrl: '/api/unknown?api_key=secret', id: 'req-1' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret');
  });

  it('returns a request ID but hides internal failures in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = response();
      errorHandler(new Error('private database error'), {
        id: 'req-1', route: { path: '/:id' }, baseUrl: '/api/orders',
        method: 'GET',
      }, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Something went wrong on our end. Please try again.',
        request_id: 'req-1',
      });
      expect(JSON.stringify(logger.log.mock.calls)).not.toContain('private database error');
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
