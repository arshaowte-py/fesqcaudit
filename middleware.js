import { NextResponse } from 'next/server';

/**
 * Per-request CSP nonce.
 *
 * Next's App Router ships its hydration bootstrap as INLINE <script> tags
 * (the self.__next_f.push flight chunks). A static `script-src 'self'` blocks
 * every one of them, so React never hydrates: the page renders from the server
 * HTML and looks fine, but no event handler is ever attached. The visible
 * symptom is a form whose submit button never enables, because onChange never
 * fires and the controlled state stays empty.
 *
 * A nonce cannot live in next.config.js because it must differ per request, so
 * the CSP is built here instead. Next reads the nonce off the incoming
 * content-security-policy header and stamps it onto its own script tags.
 *
 * Deliberately NOT using 'strict-dynamic': it makes browsers ignore 'self',
 * and the app shell at / is static HTML that loads /assets/*.js with plain
 * <script src> tags that no nonced script pulls in. 'self' + nonce keeps both
 * the Next pages and the shell working.
 */
function makeNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request) {
  const nonce = makeNonce();

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  // Static chunks are immutable files; a CSP on a .js response does nothing.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
