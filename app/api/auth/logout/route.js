import { NextResponse } from 'next/server';
import { SESSION_COOKIE, clearedSessionCookie } from '../../../../lib/auth-rules';
import { destroySession } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function signOut(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  await destroySession(token);

  const secure = process.env.NODE_ENV === 'production'
    || request.headers.get('x-forwarded-proto') === 'https';

  // Relative Location: request.url is the function's internal listener behind
  // Hosting, so an absolute redirect built from it points at localhost.
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: '/login',
      'Set-Cookie': clearedSessionCookie({ secure }),
      'Cache-Control': 'private, no-store',
    },
  });
}

export const GET = signOut;
export const POST = signOut;
