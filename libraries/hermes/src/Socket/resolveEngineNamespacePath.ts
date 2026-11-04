/**
 * Derive the Socket.IO namespace path from an Engine.IO handshake request URL.
 */
export function resolveEngineNamespacePath(req: { url?: string }): string {
  const url = req.url ?? '/';
  const pathname = url.split('?')[0] ?? '/';
  if (pathname === '/' || pathname === '') {
    return '/';
  }
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}
