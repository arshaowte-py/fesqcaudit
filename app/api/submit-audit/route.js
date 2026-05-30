import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { addAudit } from '../../../lib/audit-store';
import { notifyAuditSubmitted } from '../../../lib/audit-notification';
import { SECTION_IDS } from '../../../lib/audit-sections';

function sectionScoresFromResult(result) {
  const arr = result.sectionScores;
  if (arr && typeof arr === 'object' && !Array.isArray(arr)) return arr;
  const scores = {};
  SECTION_IDS.forEach((id, i) => {
    scores[id] = Array.isArray(arr) ? (arr[i] ?? 0) : 0;
  });
  return scores;
}

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

    const savedAudit = {
      timestamp: result.timestamp,
      storeName,
      location: location || '',
      auditorName,
      auditeeName: auditeeName || '',
      visitDate,
      sectionScores: sectionScoresFromResult(result),
      totalScore: result.totalScore,
      checkpoints: sections,
      photos: photos || [],
    };

    notifyAuditSubmitted(savedAudit).catch((err) => {
      console.error('Audit email background error:', err);
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
