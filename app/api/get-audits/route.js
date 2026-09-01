import { NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth-guard';
import { unstable_noStore as noStore } from 'next/cache';
import { getAllAudits } from '../../../lib/audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  noStore();

  const { response: authError } = await requireSession(request);
  if (authError) return authError;

  try {
    const audits = await getAllAudits();

    return NextResponse.json(audits, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Get audits error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
