/**
 * True only for Engine.IO handshake requests (polling/WebSocket upgrade),
 * not for arbitrary HTTP routes under /realtime.
 */
export function isSocketHandshake(req: { url?: string; originalUrl?: string }): boolean {
  const raw = req.url ?? req.originalUrl ?? '';
  if (!raw) {
    return false;
  }
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  if (!query) {
    return false;
  }
  const params = new URLSearchParams(query);
  return params.has('EIO') && params.has('transport');
}
