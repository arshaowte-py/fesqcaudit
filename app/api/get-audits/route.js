import { NextResponse } from 'next/server';
import { getAllAudits } from '../../../lib/audit-store';

export async function GET() {
  try {
    const audits = await getAllAudits();

    return NextResponse.json(audits, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch (error) {
    console.error('Get audits error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
