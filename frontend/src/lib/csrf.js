/**
 * The backend sets a csrf_token cookie that is deliberately NOT httpOnly -
 * only so this function can read it and echo it back as a header on
 * mutating requests (see lib/api.js). See the backend's middleware/csrf.js
 * for the full double-submit-cookie explanation.
 */
let currentToken = null;

function readCookieToken() {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return null; }
}

export function setCsrfToken(token) {
  currentToken = token || null;
}

export function getCsrfToken() {
  // The cookie is shared between tabs and can be replaced on refresh.
  // A token cached in JS can become stale even though the browser has the
  // newer cookie. Prefer the current first-party cookie in all browsers.
  return readCookieToken() || currentToken;
}
