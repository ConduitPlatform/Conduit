export function redactSecretText(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(apiKey|api_key|password|secret|token)\s*[:=]\s*\S+/gi, '$1:[REDACTED]')
    .replace(
      /\b(storageFileId|sourceUrl|connectorReference|contentVersion|sas|signature)\s*[:=]\s*\S+/gi,
      '$1:[REDACTED]',
    )
    .replace(/https?:\/\/[^\s]+/gi, '[REDACTED_URL]')
    .replace(/[?&](sig|signature|token|se|sv|sp)=[^&\s]+/gi, '&$1=[REDACTED]');
}

export function sanitizeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return redactSecretText(message);
}
