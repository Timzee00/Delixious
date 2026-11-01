import { generateCsrfToken } from '../middleware/csrf.js';

// Cookie attributes are intentionally host-only (no Domain). First-party
// /api calls work with Vite, the Netlify reverse proxy and a Render-only host.
const secure = process.env.NODE_ENV === 'production' ||
  /^https:\/\//i.test(process.env.FRONTEND_URL || '');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const validCsrfToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

const authOptions = path => ({
  httpOnly: true, secure, sameSite: 'lax', path,
});
const csrfOptions = () => ({
  httpOnly: false, secure, sameSite: 'lax', path: '/',
});

export function ensureCsrfCookie(req, res) {
  if (validCsrfToken(req.cookies?.csrf_token)) return req.cookies.csrf_token;
  const token = generateCsrfToken();
  res.cookie('csrf_token', token, { ...csrfOptions(), maxAge: THIRTY_DAYS_MS });
  return token;
}

export function setAuthCookies(res, session, { csrfToken } = {}) {
  const accessMaxAge = session.expires_in ? session.expires_in * 1000 : 60 * 60 * 1000;
  res.cookie('access_token', session.access_token, {
    ...authOptions('/'), maxAge: accessMaxAge,
  });
  res.cookie('refresh_token', session.refresh_token, {
    ...authOptions('/api/auth'), maxAge: THIRTY_DAYS_MS,
  });

  // Preserve a valid token during refresh to avoid invalidating other tabs;
  // login/signup creates a new token.
  const token = validCsrfToken(csrfToken) ? csrfToken : generateCsrfToken();
  res.cookie('csrf_token', token, { ...csrfOptions(), maxAge: THIRTY_DAYS_MS });
  return token;
}

export function clearAuthCookies(res) {
  res.clearCookie('access_token', authOptions('/'));
  res.clearCookie('refresh_token', authOptions('/api/auth'));
  res.clearCookie('csrf_token', csrfOptions());
}
