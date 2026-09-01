import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The SPA shell.
 *
 * It lives in shell/ rather than public/ on purpose: Firebase Hosting serves
 * matching files out of public/ BEFORE it applies rewrites, so a shell in
 * public/ would be handed to signed-out visitors straight off the CDN and this
 * session check would never run. Keeping it outside public/ forces every hit
 * on `/` through the function.
 */
function shellHtml() {
  if (!globalThis.__auditShellHtml) {
    globalThis.__auditShellHtml = readFileSync(
      path.join(process.cwd(), 'shell', 'index.html'),
      'utf8'
    );
  }
  return globalThis.__auditShellHtml;
}

export async function GET(request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    // A RELATIVE Location on purpose. Behind Hosting -> Cloud Run, request.url
    // reports the function's internal listener (https://localhost:3000), so
    // NextResponse.redirect(new URL('/login', request.url)) sends the browser
    // to localhost. A relative Location is resolved against the address the
    // browser actually used.
    return new NextResponse(null, {
      status: 307,
      headers: { Location: '/login', 'Cache-Control': 'private, no-store' },
    });
  }

  return new NextResponse(shellHtml(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, must-revalidate',
    },
  });
}
