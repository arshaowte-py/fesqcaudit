import { NextResponse } from 'next/server';
import { deleteAudit } from '../../../lib/audit-store';

export const dynamic = 'force-dynamic';

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { timestamp, storeName } = body;

    const result = await deleteAudit({ timestamp, storeName });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Delete audit error:', error);
    const status = error.message === 'Audit not found' ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }
}
