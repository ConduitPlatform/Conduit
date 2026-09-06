export function redactSecretText(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(apiKey|api_key|password|secret)\s*[:=]\s*\S+/gi, '$1:[REDACTED]');
}

export function sanitizeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return redactSecretText(message);
}

export function redactProviderConfig<T extends Record<string, unknown>>(config: T): T {
  const redacted = { ...config };
  for (const key of Object.keys(redacted)) {
    if (
      /^(apiKey|api_key|password|secret)$/i.test(key) &&
      typeof redacted[key] === 'string'
    ) {
      (redacted as Record<string, unknown>)[key] = '[REDACTED]';
    }
  }
  return redacted;
}
