import { parseResumeToken } from '../normalize.js';

export function parseSqlResumeId(token: string | null | undefined): string | undefined {
  if (!token) return undefined;
  if (/^\d+$/.test(token)) {
    return token;
  }
  const parsed = parseResumeToken(token);
  return decimalId(parsed);
}

export function sqlCursorFromResumeAfter(resumeAfter: unknown): string | undefined {
  return decimalId(resumeAfter);
}

function decimalId(value: unknown): string | undefined {
  if (typeof value === 'bigint' && value >= 0n) {
    return value.toString();
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return undefined;
}
