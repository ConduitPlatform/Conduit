import { EJSON } from 'bson';
import { parseResumeToken } from '../normalize.js';

export function parseSqlResumeId(token: string | null | undefined): string | undefined {
  if (!token) return undefined;
  if (/^\d+$/.test(token)) {
    return token;
  }
  try {
    const parsed = parseResumeToken(token) ?? EJSON.parse(token);
    if (typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 0) {
      return String(parsed);
    }
    if (typeof parsed === 'bigint' && parsed >= 0n) {
      return parsed.toString();
    }
    if (typeof parsed === 'string' && /^\d+$/.test(parsed)) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function sqlCursorFromResumeAfter(resumeAfter: unknown): string | undefined {
  if (
    typeof resumeAfter === 'number' &&
    Number.isInteger(resumeAfter) &&
    resumeAfter >= 0
  ) {
    return String(resumeAfter);
  }
  if (typeof resumeAfter === 'bigint' && resumeAfter >= 0n) {
    return resumeAfter.toString();
  }
  if (typeof resumeAfter === 'string' && /^\d+$/.test(resumeAfter)) {
    return resumeAfter;
  }
  return undefined;
}
