import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/lib/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  refreshSession: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

import api, { refreshSession } from '../src/lib/api.js';
import { setCsrfToken, getCsrfToken } from '../src/lib/csrf.js';
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';
import ProtectedRoute from '../src/components/ProtectedRoute.jsx';

function SessionView() {
  const { isAuthenticated, logout } = useAuth();
  return <div>
    <p>{isAuthenticated ? 'Session active' : 'No session'}</p>
    <button onClick={() => logout().catch(() => {})}>Sign out</button>
  </div>;
}
const show = () => render(
  <MemoryRouter>
    <AuthProvider>
      <ProtectedRoute><SessionView /></ProtectedRoute>
    </AuthProvider>
  </MemoryRouter>
);
const profileData = { user: { id: 'user' }, profile: { id: 'user', role: 'customer' }, csrfToken: 'x'.repeat(64) };
const apiError = (status, code) => Object.assign(new Error(code), { response: { status, data: { code } } });

describe('browser-independent session flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'csrf_token=; Max-Age=0; Path=/';
    setCsrfToken(null);
  });
  afterEach(() => {
    document.cookie = 'csrf_token=; Max-Age=0; Path=/';
    setCsrfToken(null);
  });

  it('uses the current first-party CSRF cookie after a different tab refreshes it', () => {
    setCsrfToken('a'.repeat(64));
    document.cookie = 'csrf_token=' + 'b'.repeat(64) + '; Path=/; SameSite=Lax';
    expect(getCsrfToken()).toBe('b'.repeat(64));
  });

  it('uses the first-party CSRF cookie after a page reload', () => {
    setCsrfToken(null);
    document.cookie = 'csrf_token=' + 'c'.repeat(64) + '; Path=/; SameSite=Lax';
    expect(getCsrfToken()).toBe('c'.repeat(64));
  });

  it('shows retry rather than redirecting to login during a temporary API outage', async () => {
    api.get.mockRejectedValueOnce(apiError(503, 'AUTH_UNAVAILABLE'))
      .mockResolvedValueOnce({ data: profileData });
    show();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    fireEvent.click(retry);
    expect(await screen.findByText('Session active')).toBeInTheDocument();
  });

  it('recovers when a second tab rotates the refresh cookie first', async () => {
    api.get.mockRejectedValueOnce(apiError(401, 'NO_SESSION'))
      .mockResolvedValueOnce({ data: profileData });
    refreshSession.mockRejectedValueOnce(apiError(401, 'TOKEN_EXPIRED'));
    show();
    expect(await screen.findByText('Session active')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('does not pretend logout succeeded if the API was unreachable', async () => {
    api.get.mockResolvedValueOnce({ data: profileData });
    api.post.mockRejectedValueOnce(apiError(503, 'AUTH_UNAVAILABLE'));
    show();
    const button = await screen.findByRole('button', { name: 'Sign out' });
    fireEvent.click(button);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/logout'));
    expect(screen.getByText('Session active')).toBeInTheDocument();
  });
});
