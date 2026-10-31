export const DEFAULT_TOTP_ISSUER = 'conduit';
export const TOTP_ISSUER_MAX_LENGTH = 64;

export interface TotpIssuerSettings {
  issuer?: string;
  allowedIssuers?: readonly string[];
}

function isControlCharacter(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

export function sanitizeTotpIssuer(value: string): string {
  let cleaned = '';
  for (const char of value) {
    if (char === ':') {
      continue;
    }
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined && isControlCharacter(codePoint)) {
      continue;
    }
    cleaned += char;
  }
  return cleaned.trim().slice(0, TOTP_ISSUER_MAX_LENGTH);
}

export function resolveTotpIssuer(
  settings: TotpIssuerSettings,
  requestedIssuer?: string,
): string {
  const configured = sanitizeTotpIssuer(settings.issuer ?? '') || DEFAULT_TOTP_ISSUER;
  if (!requestedIssuer || !settings.allowedIssuers?.includes(requestedIssuer)) {
    return configured;
  }
  return sanitizeTotpIssuer(requestedIssuer) || configured;
}
