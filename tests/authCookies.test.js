import { describe, it, expect, vi } from 'vitest';
import { setAuthCookies, clearAuthCookies, ensureCsrfCookie } from '../src/utils/authCookies.js';

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
    expect(clears.get('refresh_token')).toMatchObject({ path: '/api/auth', sameSite: 'lax', secure: false, httpOnly: true });
    expect(clears.get('access_token')).toMatchObject({ path: '/', sameSite: 'lax', secure: false, httpOnly: true });
    expect(clears.get('csrf_token')).toMatchObject({ path: '/', sameSite: 'lax', secure: false, httpOnly: false });
  });
  it('keeps the CSRF token stable when refreshing access cookies', () => {
    const { res, cookies } = fakeResponse();
    const token = 'a'.repeat(64);
    expect(setAuthCookies(res, sampleSession, { csrfToken: token })).toBe(token);
    expect(cookies.get('csrf_token').value).toBe(token);
  });

  it('reissues a missing CSRF cookie without changing authentication cookies', () => {
    const { res, cookies } = fakeResponse();
    const token = ensureCsrfCookie({ cookies: {} }, res);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(cookies.size).toBe(1);
    expect(cookies.get('csrf_token').options.path).toBe('/');
  });

  it('uses an existing valid CSRF cookie without sending a new cookie', () => {
    const { res } = fakeResponse();
    const token = 'b'.repeat(64);
    expect(ensureCsrfCookie({ cookies: { csrf_token: token } }, res)).toBe(token);
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
