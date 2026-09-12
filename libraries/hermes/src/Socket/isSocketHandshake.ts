export function isSocketHandshake(req: { url?: string; originalUrl?: string }): boolean {
  const raw = req.url ?? req.originalUrl ?? '';
  if (!raw) {
    return false;
  }
  const queryIndex = raw.indexOf('?');
  const pathname = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  if (pathname.includes('ticket')) {
    return false;
  }
  const query = queryIndex === -1 ? '' : raw.slice(queryIndex + 1);
  if (!query) {
    return false;
  }
  const params = new URLSearchParams(query);
  if (!params.has('EIO') || !params.has('transport')) {
    return false;
  }
  if (params.has('sid')) {
    return false;
  }
  if (pathname !== '/' && !pathname.endsWith('/')) {
    return false;
  }
  return true;
}
