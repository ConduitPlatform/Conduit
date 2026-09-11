export function redactSecretText(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(apiKey|api_key|password|secret)\s*[:=]\s*\S+/gi, '$1:[REDACTED]');
}

export function sanitizeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return redactSecretText(message);
}
