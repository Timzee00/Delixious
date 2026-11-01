import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api, { refreshSession, setUnauthorizedHandler } from '../lib/api.js';
import { setCsrfToken } from '../lib/csrf.js';

const AuthContext = createContext(null);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionIssue, setSessionIssue] = useState('');
  // Prevent an older startup request from overwriting a newer login.
  const sessionGeneration = useRef(0);

  const applySession = useCallback((data) => {
    setUser(data.user);
    setProfile(data.profile);
    setCsrfToken(data.csrfToken);
    setSessionIssue('');
    return data.profile;
  }, []);

  const refreshProfile = useCallback(async () => {
    let lastError = null;
    setSessionIssue('');
    const generation = sessionGeneration.current;
    const isCurrent = () => generation === sessionGeneration.current;

    // A fresh browser can briefly be offline, waking from sleep, or waiting
    // for its first network connection. Retry bootstrap before deciding that
    // the user is logged out instead of bouncing them to /login prematurely.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { data } = await api.get('/auth/me');
        return isCurrent() ? applySession(data) : null;
      } catch (error) {
        lastError = error;

        // If the access cookie is missing/expired, try the long-lived refresh
        // cookie once. refreshSession is intentionally allowed without a CSRF
        // header by the backend because it is itself authenticated by the
        // httpOnly refresh cookie.
        const code = error.response?.data?.code;
        if (error.response?.status === 401 && (code === 'NO_SESSION' || code === 'TOKEN_EXPIRED')) {
          try {
            const { data } = await refreshSession();
            return isCurrent() ? applySession(data) : null;
          } catch (refreshError) {
            lastError = refreshError;
          }
        }

        if (!error.response && attempt === 0) {
          await sleep(350);
          continue;
        }
        break;
      }
    }

    if (isCurrent()) {
      const status = lastError?.response?.status;
      // Loading the API is not the same thing as being signed out. A sleeping
      // server or failed network should offer Retry rather than redirect users
      // to login and lose their current flow.
      if (lastError && (!status || status >= 500)) {
        setSessionIssue('We could not reach Delixious. Check your connection and try again.');
      } else if (status === 401 || status === 403) {
        setUser(null);
        setProfile(null);
      }
    }
    return null;
  }, [applySession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setProfile(null);
    });

    (async () => {
      await refreshProfile();
      setLoading(false);
    })();
  }, [refreshProfile]);

  async function login(email, password) {
    sessionGeneration.current += 1;
    const { data } = await api.post('/auth/login', { email, password });
    applySession(data);
    return data;
  }

  async function signup(payload) {
    const { data } = await api.post('/auth/signup', payload);
    if (data.user) {
      await refreshProfile();
    }
    return data;
  }

  async function logout() {
    // A failed request must not pretend the server's httpOnly session cookie
    // has been revoked: that would sign the user straight back in on refresh.
    await api.post('/auth/logout');
    sessionGeneration.current += 1;
    setUser(null);
    setProfile(null);
    setCsrfToken(null);
    setSessionIssue('');
  }

  async function retrySession() {
    setLoading(true);
    try { return await refreshProfile(); }
    finally { setLoading(false); }
  }

  async function updateProfile(payload) {
    const { data } = await api.put('/auth/profile', payload);
    setProfile(data.profile);
    return data;
  }

  const value = {
    user,
    profile,
    loading,
    sessionIssue,
    retrySession,
    login,
    signup,
    logout,
    updateProfile,
    isAuthenticated: Boolean(profile),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider.');
  return ctx;
}
