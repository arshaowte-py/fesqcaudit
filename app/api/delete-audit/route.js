import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { deleteAudit } from '../../../lib/audit-store';
import { notifyAuditDeleted } from '../../../lib/audit-notification';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(request) {
  noStore();

  try {
    const body = await request.json();
    const { timestamp, storeName, auditorName, auditeeName, visitDate } = body;

    const result = await deleteAudit({ timestamp, storeName });

    await notifyAuditDeleted({ storeName, auditorName, auditeeName, visitDate, timestamp }).catch((err) => {
      console.error('Delete notification background error:', err);
    });

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
