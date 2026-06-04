import { createClient } from '@supabase/supabase-js';

let adminClient = null;

/** Accept both common env var names (Vercel / local). */
export function getSupabaseServiceKey() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_SECRET_ROLE_KEY ||
    '';
  return key.trim();
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && getSupabaseServiceKey());
}

export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) return null;

  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL.trim(), getSupabaseServiceKey().trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}

/** Project ref embedded in the service_role JWT (middle segment). */
export function getServiceRoleProjectRef() {
  const key = getSupabaseServiceKey();
  if (!key || key.split('.').length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(key.split('.')[1], 'base64url').toString('utf8')
    );
    return payload.ref || null;
  } catch {
    return null;
  }
}

export function getExpectedSupabaseUrl() {
  const ref = getServiceRoleProjectRef();
  return ref ? `https://${ref}.supabase.co` : null;
}

/** Turn low-level fetch/DNS errors into actionable messages for the UI. */
export function supabaseConnectionError(err) {
  const msg = String(err?.message || err || '');
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(msg)) {
    const expected = getExpectedSupabaseUrl();
    const hint = expected
      ? ` Your service_role key expects SUPABASE_URL=${expected}`
      : '';
    return new Error(
      `Cannot reach Supabase (wrong Project URL or DNS).${hint} Copy Project URL from Supabase → Connect, update .env.local, then restart: npm run dev.`
    );
  }
  return err instanceof Error ? err : new Error(msg || 'Supabase request failed');
}
