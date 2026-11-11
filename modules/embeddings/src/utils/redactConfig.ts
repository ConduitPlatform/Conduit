import { parseErrorPayload } from '@conduitplatform/grpc-sdk';

export function redactSecretText(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(apiKey|api_key|password|secret)\s*[:=]\s*\S+/gi, '$1:[REDACTED]');
}

/** Human-readable, secret-redacted text of an error (never a typed error's JSON). */
export function sanitizeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? parseErrorPayload(err).message : String(err);
  return redactSecretText(message);
}
