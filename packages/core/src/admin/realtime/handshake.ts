export function isSocketHandshake(req: {
  url?: string;
  originalUrl?: string;
  path?: string;
}): boolean {
  const parts = [req.url, req.originalUrl, req.path].filter((value): value is string =>
    Boolean(value),
  );
  return parts.some(part => part.includes('EIO=') || isRealtimePath(part));
}

function isRealtimePath(value: string): boolean {
  return /(?:^|[/?])realtime(?:[/?]|$)/.test(value);
}
