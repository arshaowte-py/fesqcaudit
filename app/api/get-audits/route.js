import { NextResponse } from 'next/server';
import { getAllAudits } from '../../../lib/audit-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const audits = await getAllAudits();

    return NextResponse.json(audits, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
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
