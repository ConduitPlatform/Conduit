import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const DEFAULT_TOTP_ISSUER = 'Conduit';
export const TOTP_ISSUER_MAX_LENGTH = 64;

export interface TotpIssuerSettings {
  issuer?: string;
  allowedIssuers?: readonly string[];
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function stripUnsafe(value: string): string {
  // ':' separates the otpauth label; Cc are control and Cf are bidi/zero-width characters,
  // except the joiners (ZWNJ, ZWJ) that emoji sequences and some scripts need
  return value.replace(/(?![\u200c\u200d])[:\p{Cc}\p{Cf}]/gu, '').trim();
}

function graphemeCount(value: string): number {
  return [...graphemes.segment(value)].length;
}

export function sanitizeTotpIssuer(value: string): string {
  const kept = [...graphemes.segment(stripUnsafe(value))]
    .slice(0, TOTP_ISSUER_MAX_LENGTH)
    .map(({ segment }) => segment);
  return kept.join('').trimEnd();
}

function issuerError(path: string, value: unknown): string | null {
  if (typeof value !== 'string') return `${path} must be a string`;
  const cleaned = stripUnsafe(value);
  if (!cleaned.replace(/[\u200c\u200d]/g, '')) return `${path} must not be empty`;
  if (graphemeCount(cleaned) > TOTP_ISSUER_MAX_LENGTH) {
    return `${path} must be at most ${TOTP_ISSUER_MAX_LENGTH} characters`;
  }
  return null;
}

export function totpIssuerConfigError(twoFa: unknown): string | null {
  if (!twoFa || typeof twoFa !== 'object') return null;
  const { issuer, allowedIssuers } = twoFa as Record<string, unknown>;
  if (issuer !== undefined) {
    const error = issuerError('twoFa.issuer', issuer);
    if (error) return error;
  }
  if (allowedIssuers === undefined) return null;
  if (!Array.isArray(allowedIssuers)) return 'twoFa.allowedIssuers must be a list';
  for (const [index, entry] of allowedIssuers.entries()) {
    const error = issuerError(`twoFa.allowedIssuers[${index}]`, entry);
    if (error) return error;
  }
  return null;
}

export function resolveTotpIssuer(
  settings: TotpIssuerSettings,
  requestedIssuer?: string,
): string {
  if (!requestedIssuer) {
    return sanitizeTotpIssuer(settings.issuer ?? '') || DEFAULT_TOTP_ISSUER;
  }
  const requested = stripUnsafe(requestedIssuer);
  const allowed = (settings.allowedIssuers ?? []).map(sanitizeTotpIssuer);
  if (issuerError('issuer', requestedIssuer) || !allowed.includes(requested)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Issuer is not allowed');
  }
  return requested;
}
