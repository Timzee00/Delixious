import axios from 'axios';
import { getCsrfToken, setCsrfToken } from './csrf.js';

// Use a first-party API URL in every environment. Vite and Netlify proxy /api
// to the server while the browser retains its own origin for auth cookies.
// Ignore an old VITE_API_URL value that points to a separate backend.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 25000,
});

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
  if (MUTATING_METHODS.has((config.method || '').toLowerCase())) {
    const token = getCsrfToken();
    if (token) config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

let refreshPromise = null;
let csrfRepairPromise = null;

// If a browser lost its readable CSRF cookie but retained its httpOnly
// session, /auth/me can reissue the missing cookie without a logout.
async function repairCsrfCookie() {
  if (!csrfRepairPromise) {
    csrfRepairPromise = api.get('/auth/me')
      .then(({ data }) => setCsrfToken(data.csrfToken))
      .finally(() => { csrfRepairPromise = null; });
  }
  return csrfRepairPromise;
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh')
      .then((res) => {
        setCsrfToken(res.data.csrfToken);
        return res;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => {
    // A missing /api Netlify rewrite can serve index.html with HTTP 200.
    // Treat HTML as a transport error, never as a successful login/checkout.
    if (typeof response.data === 'string' && /^\\s*(?:<!doctype html|<html\\b)/i.test(response.data.slice(0, 256))) {
      const error = new Error('Delixious API routing is unavailable. Please try again shortly.');
      error.code = 'API_PROXY_MISCONFIGURED';
      error.config = response.config;
      return Promise.reject(error);
    }
    return response;
  },
  async (error) => {
    const { config, response } = error;
    const isAuthRefreshRequest = config?.url?.endsWith('/auth/refresh');
    const isAuthBootstrapRequest = config?.url?.endsWith('/auth/me');
    const isExpiredToken = response?.status === 401 && response?.data?.code === 'TOKEN_EXPIRED';
    const isNoSession = response?.status === 401 && response?.data?.code === 'NO_SESSION';

    // The refresh request itself must never recursively trigger another refresh.
    if (isAuthRefreshRequest) {
      return Promise.reject(error);
    }

    // The server rejects CSRF failures before reaching a business handler.
    // Repair the cookie through a safe GET, then retry at most once.
    if (response?.status === 403 && response?.data?.code === 'CSRF_TOKEN_INVALID' && config && !config._csrfRetried) {
      config._csrfRetried = true;
      try {
        await repairCsrfCookie();
        return api(config);
      } catch (repairError) {
        return Promise.reject(repairError);
      }
    }

    // Expired access tokens can be recovered using the httpOnly refresh cookie.
    if (isExpiredToken && !config._retried) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch (refreshError) {
        // The refresh may have raced with a newer successful login.
        // Let the auth provider reconcile the session instead of clearing it here.
        return Promise.reject(refreshError);
      }
    }

    // A missing access cookie during initial app bootstrap can still have a
    // valid refresh cookie. Let AuthContext explicitly attempt refresh once.
    // Do not immediately erase auth state here for /auth/me.
    if (isNoSession && isAuthBootstrapRequest) {
      return Promise.reject(error);
    }

    // A 401 from a separate endpoint must not destroy a valid login session.
    // Session invalidation is owned by the explicit auth bootstrap/refresh flow.
    return Promise.reject(error);
  }
);

export { refreshSession };
export default api;
