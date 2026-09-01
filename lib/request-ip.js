/**
 * Client IP as seen through Firebase Hosting -> Cloud Run. The leftmost
 * x-forwarded-for entry is the original client; everything after it is
 * infrastructure.
 */
export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('fastly-client-ip')
    || request.headers.get('x-real-ip')
    || 'unknown';
}
