import { NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth-guard';
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
export const maxDuration = 60;

export async function POST(request) {
  noStore();

  const { response: authError } = await requireSession(request);
  if (authError) return authError;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            'Request too large or invalid. Remove some photos and try again (max ~4 MB total).',
        },
        { status: 413 }
      );
    }
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

    if (!result.duplicate) {
      await notifyAuditSubmitted(savedAudit).catch((err) => {
        console.error('Audit email background error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      duplicate: Boolean(result.duplicate),
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
