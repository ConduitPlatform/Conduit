export const DEFAULT_TOTP_ISSUER = 'conduit';
export const TOTP_ISSUER_MAX_LENGTH = 64;

export interface TotpIssuerSettings {
  issuer?: string;
  allowedIssuers?: readonly string[];
}

export function sanitizeTotpIssuer(value: string): string {
  return value
    .replace(/[:\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, TOTP_ISSUER_MAX_LENGTH);
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
