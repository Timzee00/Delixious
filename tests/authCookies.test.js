import { describe, it, expect, vi } from 'vitest';
import { setAuthCookies, clearAuthCookies } from '../src/utils/authCookies.js';

function fakeResponse() {
  const cookies = new Map();
  const clears = new Map();
  const res = {
    cookie: vi.fn((name, value, options) => { cookies.set(name, { value, options }); return res; }),
    clearCookie: vi.fn((name, options) => { clears.set(name, options); return res; }),
  };
  return { res, cookies, clears };
}

const sampleSession = {
  access_token: 'test-access',
  refresh_token: 'test-refresh',
  expires_in: 3600,
};

describe('authentication cookies', () => {
  it('uses Lax for all cookies in local HTTP so browsers accept them', () => {
    const { res, cookies } = fakeResponse();
    const csrf = setAuthCookies(res, sampleSession);
    expect(cookies.size).toBe(3);
    const access = cookies.get('access_token');
    const refresh = cookies.get('refresh_token');
    const csrfCookie = cookies.get('csrf_token');

    for (const cookie of [access, refresh, csrfCookie]) {
      expect(cookie.options.sameSite).toBe('lax');
      expect(cookie.options.secure).toBe(false); // tests/setup.js sets HTTP dev URL
      expect(cookie.options.path).toBeTruthy();
    }

    expect(access.options.httpOnly).toBe(true);
    expect(access.options.path).toBe('/');
    expect(access.options.maxAge).toBe(3600_000);
    expect(refresh.options.httpOnly).toBe(true);
    expect(refresh.options.path).toBe('/api/auth');
    expect(csrfCookie.options.httpOnly).toBe(false);
    expect(csrf).toMatch(/^[a-f0-9]{64}$/);
    expect(csrfCookie.value).toBe(csrf);
  });

  it('clears refresh cookie using the same restricted path', () => {
    const { res, clears } = fakeResponse();
    clearAuthCookies(res);
    expect(clears.get('refresh_token')).toEqual({ path: '/api/auth' });
    expect(clears.get('access_token')).toEqual({ path: '/' });
    expect(clears.get('csrf_token')).toEqual({ path: '/' });
  });
});
