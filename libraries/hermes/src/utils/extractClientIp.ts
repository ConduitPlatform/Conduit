import type { IncomingHttpHeaders } from 'node:http';

function normalizeHeader(
  headers: IncomingHttpHeaders | Record<string, unknown>,
  key: string,
): string | undefined {
  const v = (headers as IncomingHttpHeaders)[key];
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null || s === '') return undefined;
  return typeof s === 'string' ? s : String(s);
}

/**
 * Resolves the client IP from proxy headers (same precedence as the global router rate limiter).
 * For `x-forwarded-for`, uses the first hop (left-most) when comma-separated.
 */
export function extractClientIp(
  headers: IncomingHttpHeaders | Record<string, unknown>,
  fallbackIp?: string,
): string {
  const cf = normalizeHeader(headers, 'cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = normalizeHeader(headers, 'x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const xri = normalizeHeader(headers, 'x-real-ip');
  if (xri) return xri.trim();
  const xof = normalizeHeader(headers, 'x-original-forwarded-for');
  if (xof) return xof.split(',')[0]!.trim();
  if (fallbackIp != null && fallbackIp !== '') {
    return typeof fallbackIp === 'string' ? fallbackIp : String(fallbackIp);
  }
  return 'unknown';
}
