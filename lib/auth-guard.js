import { NextResponse } from 'next/server';
import { getSessionFromRequest } from './session.js';
import { getDb } from './firebase-admin.js';

/**
 * The single gate every API route calls.
 *
 * Kept in one place on purpose: a guard copy-pasted into each handler drifts,
 * and the route that gets missed is the one that leaks. test/auth-coverage
 * asserts that every route file under app/api (except the auth endpoints
 * themselves) imports this module.
 */
export async function requireSession(request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { success: false, error: 'Not signed in.' },
        { status: 401 }
      ),
    };
  }
  return { session, response: null };
}

/**
 * Deletion is a privileged action, gated by a flag on the user document.
 *
 * This replaces the previous control, which was an array of phone numbers
 * hardcoded into public/assets/responses.js and checked in the browser — it
 * shipped the whole allowlist to every visitor and anyone could skip it by
 * calling the API directly.
 */
export async function requireDeletePermission(request) {
  const { session, response } = await requireSession(request);
  if (response) return { session: null, response };

  const snap = await getDb().collection('users').doc(session.email).get();
  if (snap.get('canDelete') !== true) {
    return {
      session: null,
      response: NextResponse.json(
        { success: false, error: 'You do not have permission to delete audits.' },
        { status: 403 }
      ),
    };
  }
  return { session, response: null };
}
