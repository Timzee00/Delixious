import { describe, expect, it } from 'vitest';
import api from '../src/lib/api.js';

describe('browser transport routing', () => {
  it('always uses the local API path', () => {
    expect(api.defaults.baseURL).toBe('/api');
    expect(api.defaults.withCredentials).toBe(true);
  });
  it('does not treat a misrouted HTML page as a successful JSON response', async () => {
    const adapter = async config => ({
      config, data: '<!DOCTYPE html><html><body>App</body></html>',
      headers: { 'content-type': 'text/html' },
      status: 200, statusText: 'OK',
    });
    await expect(api.get('/auth/me', { adapter })).rejects.toMatchObject({
      code: 'API_PROXY_MISCONFIGURED',
    });
  });
});
