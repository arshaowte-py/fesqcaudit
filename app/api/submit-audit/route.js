import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { addAudit } from '../../../lib/audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  noStore();

  try {
    const body = await request.json();
    const {
      storeName,
      location,
      auditorName,
      auditeeName,
      visitDate,
      sections,
      photos,
    } = body;

    if (!storeName || !auditorName || !visitDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await addAudit({
      storeName,
      location,
      auditorName,
      auditeeName,
      visitDate,
      sections,
      photos,
    });

    return NextResponse.json({
      success: true,
      timestamp: result.timestamp,
      rowNumber: result.rowNumber,
      totalScore: result.totalScore,
      sectionScores: result.sectionScores,
    });
  } catch (error) {
    console.error('Submit audit error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
