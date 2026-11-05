import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Live delivery tracking is a nice-to-have, not a requirement: if these
// aren't configured, the order tracking page still works via the REST
// endpoint, it just won't push live location updates without a refresh.
// Realtime uses this browser client, not Delixious sign-in. Prevent it from
// starting an unrelated session in browser storage or consuming auth URL tokens.
const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
}) : null;

export default supabase;
