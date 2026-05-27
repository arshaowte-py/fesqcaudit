import { createClient } from '@supabase/supabase-js';

let adminClient = null;

/** Accept both common env var names (Vercel / local). */
export function getSupabaseServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_SECRET_ROLE_KEY ||
    ''
  );
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseServiceKey());
}

export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) return null;

  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, getSupabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}
