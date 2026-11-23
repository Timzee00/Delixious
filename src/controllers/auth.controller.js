import crypto from 'node:crypto';
import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { createSubaccount, createTransferRecipient } from '../utils/paystack.js';
import { setAuthCookies, clearAuthCookies, ensureCsrfCookie } from '../utils/authCookies.js';
import logger from '../utils/logger.js';


function serializeProfile(profile) {
  if (!profile) return profile;
  const {
    rider_bank_account_number,
    rider_bank_account_name,
    rider_paystack_subaccount_code,
    rider_transfer_recipient_code,
    ...safe
  } = profile;
  return {
    ...safe,
    rider_payout_account_connected: Boolean(rider_transfer_recipient_code),
    rider_bank_account_last4: rider_bank_account_number ? rider_bank_account_number.slice(-4) : null,
  };
}

export async function signup(req, res, next) {
  try {
    const { email, password, full_name, phone, role = 'customer' } = req.body;

    // Never accept the privileged admin role from public signup.
    // The database trigger also enforces this as defense-in-depth.
    const safeRole = role === 'restaurant_owner' || role === 'delivery_agent' ? role : 'customer';

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone, role: safeRole } },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    let csrfToken;
    if (data.session) {
      csrfToken = setAuthCookies(res, data.session);
    }

    res.status(201).json({
      message: data.session
        ? 'Account created successfully.'
        : 'Account created. Please check your email to confirm your account.',
      user: data.session ? { id: data.user.id, email: data.user.email } : undefined,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function submitRiderBankDetails(req, res, next) {
  try {
    const { bank_name, bank_code, account_number } = req.body;

    if (req.profile.rider_transfer_recipient_code || req.profile.rider_paystack_subaccount_code) {
      return res.status(409).json({ error: 'A payout account is already recorded. Contact support to change it safely.' });
    }

    const subaccountResponse = await createSubaccount({
      businessName: req.profile.full_name,
      bankCode: bank_code,
      accountNumber: account_number,
      percentageCharge: 10,
    });

    if (!subaccountResponse.status) {
      return res.status(502).json({ error: 'Could not verify bank details with Paystack. Please check the details and try again.' });
    }

    const recipientResponse = await createTransferRecipient({
      name: req.profile.full_name,
      bankCode: bank_code,
      accountNumber: account_number,
    });

    if (!recipientResponse.status) {
      return res.status(502).json({ error: 'Could not set up payouts with Paystack. Please try again.' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        rider_bank_name: bank_name,
        rider_bank_account_number: account_number,
        rider_bank_account_name: subaccountResponse.data.account_name,
        rider_paystack_subaccount_code: subaccountResponse.data.subaccount_code,
        rider_transfer_recipient_code: recipientResponse.data.recipient_code,
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(500).json({ error: 'The payout account was verified but could not be saved.' });
    res.json({ message: 'Payout account connected.', payout_account_connected: true, bank_account_last4: account_number.slice(-4) });
  } catch (err) {
    if (err.response?.data?.message) {
      return res.status(400).json({ error: err.response.data.message });
    }
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Your account profile could not be loaded. Please contact support.' });
    }

    if (profile.is_suspended) {
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.', code: 'ACCOUNT_SUSPENDED' });
    }

    const csrfToken = setAuthCookies(res, data.session);

    res.json({
      message: 'Logged in successfully.',
      user: { id: data.user.id, email: data.user.email },
      profile: serializeProfile(profile),
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No session to refresh. Please log in again.', code: 'NO_SESSION' });
    }

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data?.session) {
      // Never send cookie-deletion headers for a failed refresh: another tab
      // may already have rotated the same token and stored a newer session.
      // A retryable Supabase outage is also not an invalid login.
      const retryable = error?.status >= 500 || error?.name === 'AuthRetryableFetchError';
      return res.status(retryable ? 503 : 401).json({
        error: retryable ? 'Session verification is temporarily unavailable. Try again.' : 'Your session has expired. Please log in again.',
        code: retryable ? 'AUTH_UNAVAILABLE' : 'TOKEN_EXPIRED',
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      // A database outage must not force a user to sign out.
      return res.status(503).json({
        error: 'Your account could not be checked right now. Try again.',
        code: 'AUTH_UNAVAILABLE',
      });
    }
    if (!profile) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Your account profile could not be loaded.', code: 'PROFILE_NOT_FOUND' });
    }

    if (profile.is_suspended) {
      clearAuthCookies(res);
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.', code: 'ACCOUNT_SUSPENDED' });
    }

    const csrfToken = setAuthCookies(res, data.session, { csrfToken: req.cookies?.csrf_token });

    res.json({
      message: 'Session refreshed.',
      user: { id: data.user.id, email: data.user.email },
      profile: serializeProfile(profile),
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.access_token;

    if (token) {
      await supabaseAdmin.auth.admin.signOut(token).catch((err) => {
        logger.warn('Supabase signOut call failed during logout', { error: err.message });
      });
    }

    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res) {
  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile: serializeProfile(req.profile),
    csrfToken: ensureCsrfCookie(req, res),
  });
}

export async function updateProfile(req, res, next) {
  try {
    // The validation schema should only allow profile fields. Keep an explicit
    // allow-list here as defense-in-depth so a future schema change cannot
    // accidentally expose role, suspension, approval or payout fields.
    const { full_name, phone, avatar_url } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Profile updated.', profile: serializeProfile(data) });
  } catch (err) {
    next(err);
  }
}


export async function requestPasswordReset(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const redirectTo = `${process.env.FRONTEND_URL}/reset-password`;
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      logger.warn('Password reset request could not be sent', { message: error.message });
      return res.status(503).json({ error: 'Password recovery is temporarily unavailable. Please try again shortly.' });
    }
    // Always return the same success response whether or not the email belongs
    // to an account. Supabase also applies its own email throttling.
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (err) { next(err); }
}

function recoveryCookieValue(userId, expiresAt) {
  const payload = `${userId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

function isRecoverySession(accessToken) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
    return Array.isArray(payload.amr) && payload.amr.some(method => method?.method === 'recovery');
  } catch {
    return false;
  }
}

export async function createPasswordRecoverySession(req, res, next) {
  try {
    let data, error;
    if (req.body.token_hash) {
      ({ data, error } = await supabaseAnon.auth.verifyOtp({
        token_hash: req.body.token_hash,
        type: 'recovery',
      }));
    } else {
      ({ data, error } = await supabaseAnon.auth.setSession({
        access_token: req.body.access_token,
        refresh_token: req.body.refresh_token,
      }));
    }
    if (error || !data?.session || !data?.user || !isRecoverySession(data.session.access_token)) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired. Request a new one.' });
    }
    const csrfToken = setAuthCookies(res, data.session);
    const expiresAt = Date.now() + 10 * 60 * 1000;
    res.cookie('password_recovery', recoveryCookieValue(data.user.id, expiresAt), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/password',
      maxAge: 10 * 60 * 1000,
    });
    res.json({ user: { id: data.user.id, email: data.user.email }, csrfToken });
  } catch (err) { next(err); }
}

export async function updatePassword(req, res, next) {
  try {
    const password = String(req.body.password || '');
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }
    const parts = String(req.cookies?.password_recovery || '').split(':');
    const [userId, expiresAtText, signature] = parts;
    const expiresAt = Number(expiresAtText);
    const payload = `${userId}:${expiresAtText}`;
    const expected = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(payload).digest('hex');
    const suppliedBuffer = /^[a-f0-9]{64}$/i.test(signature || '') ? Buffer.from(signature, 'hex') : Buffer.alloc(0);
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (userId !== req.user.id || !Number.isFinite(expiresAt) || expiresAt < Date.now() ||
        suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
      return res.status(403).json({ error: 'Your password reset session has expired. Request a fresh reset link.' });
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password });
    if (error) throw error;
    res.clearCookie('password_recovery', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/password',
    });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) { next(err); }
}
