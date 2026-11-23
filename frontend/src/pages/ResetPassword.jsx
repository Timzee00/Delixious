import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';

export default function ResetPassword() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const recoveryStarted = useRef(false);
  const [mode, setMode] = useState('request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (recoveryStarted.current) return;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    const tokenHash = query.get('token_hash');

    if (fragment.get('type') !== 'recovery' && !tokenHash) return;
    if (!tokenHash && (!accessToken || !refreshToken)) return;

    recoveryStarted.current = true;
    setMode('verifying');
    setError('');
    const payload = tokenHash ? { token_hash: tokenHash } : {
      access_token: accessToken,
      refresh_token: refreshToken,
    };

    api.post('/auth/password/recovery-session', payload)
      .then(({ data }) => {
        setEmail(data.user?.email || '');
        setMode('update');
        setNotice('Your reset link has been verified. Choose a new password.');
        // Remove one-time recovery credentials from the address bar.
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(err => {
        setMode('request');
        setError(err.response?.data?.error || 'This password reset link is invalid or has expired. Request a new one.');
        window.history.replaceState({}, document.title, window.location.pathname);
      });
  }, []);

  async function requestReset(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/auth/password/reset-request', { email: email.trim() });
      setRequestSent(true);
      setNotice('If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.');
    } catch (err) {
      // The API intentionally returns a generic response to avoid account enumeration.
      setError(err.response?.data?.error || 'Could not request a reset link right now. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  async function saveNewPassword(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.put('/auth/password', { password: newPassword });
      await refreshProfile();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update your password. Request a fresh reset link and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="ticket w-full p-6 sm:p-9">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">ACCOUNT RECOVERY</p>
        {mode === 'verifying' ? (
          <>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">Verifying your reset link</h1>
            <p role="status" className="mt-2 text-sm text-ink-soft">Checking your secure recovery link…</p>
          </>
        ) : mode === 'update' ? (
          <>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">Choose a new password</h1>
            <p className="mt-2 text-sm text-ink-soft">Set a new password for {email || 'your Delixious account'}.</p>
            <form onSubmit={saveNewPassword} className="mt-6 space-y-4">
              <FormField label="New password" type="password" value={newPassword} onChange={setNewPassword}
                placeholder="At least 8 characters" minLength={8} required autoComplete="new-password"/>
              <p className="text-xs text-ink-soft">Use at least 8 characters. You will be signed in after the password is changed.</p>
              <button type="submit" disabled={busy || newPassword.length < 8} className="min-h-12 w-full rounded-xl bg-pepper px-5 py-3 text-sm font-semibold text-white transition hover:bg-pepper-dark disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? 'Updating password…' : 'Update password'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">Forgot your password?</h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">Enter the email address linked to your account. We’ll send a secure reset link if an account matches.</p>
            <form onSubmit={requestReset} className="mt-6 space-y-4">
              <FormField label="Email address" type="email" value={email} onChange={value => { setEmail(value); setRequestSent(false); }}
                placeholder="you@example.com" required autoComplete="email"/>
              <button type="submit" disabled={busy || !email.trim()} className="min-h-12 w-full rounded-xl bg-pepper px-5 py-3 text-sm font-semibold text-white transition hover:bg-pepper-dark disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? 'Sending reset link…' : requestSent ? 'Send another reset link' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
        {notice && <p role="status" className="mt-4 rounded-xl border border-jade/20 bg-jade-soft px-4 py-3 text-sm text-jade">{notice}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
        <p className="mt-7 text-center text-sm text-ink-soft">
          Remembered your password? <Link to="/login" className="font-semibold text-pepper hover:underline">Back to log in</Link>
        </p>
      </section>
    </main>
  );
}
