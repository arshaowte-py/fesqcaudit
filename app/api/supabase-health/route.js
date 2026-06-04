import { NextResponse } from 'next/server';
import {
  getExpectedSupabaseUrl,
  getSupabaseAdmin,
  getServiceRoleProjectRef,
  isSupabaseConfigured,
} from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/supabase-health — quick check that env + Supabase are reachable */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      reason: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set (or empty).',
    });
  }

  const configuredUrl = process.env.SUPABASE_URL?.trim() || '';
  const expectedUrl = getExpectedSupabaseUrl();
  const jwtRef = getServiceRoleProjectRef();

  if (expectedUrl && configuredUrl !== expectedUrl) {
    return NextResponse.json({
      ok: false,
      reason: `SUPABASE_URL does not match your service_role key. Use: ${expectedUrl}`,
      configuredUrl,
      expectedUrl,
      jwtRef,
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('audits')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({ ok: false, reason: error.message, jwtRef });
    }

    return NextResponse.json({
      ok: true,
      auditsTableRows: count ?? 0,
      url: configuredUrl,
      jwtRef,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      reason: err.message || String(err),
      jwtRef,
      expectedUrl: expectedUrl || undefined,
    });
  }
}
