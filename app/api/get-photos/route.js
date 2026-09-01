import { NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth-guard';
import { unstable_noStore as noStore } from 'next/cache';
import { getPhotos } from '../../../lib/audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  noStore();

  const { response: authError } = await requireSession(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp');
    const store = searchParams.get('store');

    const photos = await getPhotos({ timestamp, store });

    return NextResponse.json(photos, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch (error) {
    console.error('Get photos error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
