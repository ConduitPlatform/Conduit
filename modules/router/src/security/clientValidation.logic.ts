import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { isIP } from 'node:net';

export const CLIENT_SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const CLIENT_SECRET_KEY_B64 = /^[A-Za-z0-9+/]{43}=$/;
const DNS_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function decodedClientSecretKey(value: string): Buffer | null {
  if (!CLIENT_SECRET_KEY_B64.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== value) return null;
  return decoded;
}

export function assertClientSecretEncryptionKey(value: unknown): asserts value is string {
  if (typeof value !== 'string' || decodedClientSecretKey(value) === null) {
    throw new Error(
      'security.clientSecretEncryptionKey must be base64 for exactly 32 bytes',
    );
  }
}

export function clientSecretKeyBytes(value: string): Buffer {
  assertClientSecretEncryptionKey(value);
  return decodedClientSecretKey(value)!;
}

export function encryptClientSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptClientSecret(blob: string, key: Buffer): string {
  const packed = Buffer.from(blob, 'base64');
  if (packed.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid client secret ciphertext');
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function hostnameFromOrigin(origin: string): string | null {
  const trimmed = origin.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    const hostname = new URL(withScheme).hostname.toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

export function requestHostname(
  origin: string | undefined,
  fallbackHostname: string,
): string {
  if (origin) {
    const parsed = hostnameFromOrigin(origin);
    if (parsed) return parsed;
  }
  return fallbackHostname.trim().toLowerCase();
}

export function domainAllowsHost(storedDomain: string, host: string): boolean {
  const domain = storedDomain.trim().toLowerCase();
  const hostname = host.trim().toLowerCase();
  if (domain === '*') return true;
  if (domain.startsWith('*.')) {
    const suffix = `.${domain.slice(2)}`;
    return suffix.length > 1 && hostname.endsWith(suffix);
  }
  return comparableHost(domain) === hostname;
}

export function isAcceptableClientDomain(domain: string): boolean {
  if (
    !domain ||
    domain !== domain.trim() ||
    domain.includes('://') ||
    /\s/.test(domain)
  ) {
    return false;
  }
  if (domain === '*') return true;
  const stars = domain.match(/\*/g);
  if (stars) {
    if (stars.length !== 1 || !domain.startsWith('*.')) return false;
    return DNS_HOSTNAME.test(domain.slice(2));
  }
  const split = splitHostAndPort(domain);
  if (!split) return false;
  const host = split.host;
  if (host.toLowerCase() === 'localhost') return true;
  if (isIP(host) !== 0) return true;
  return DNS_HOSTNAME.test(host);
}

export function sha256Hex(bytes: Buffer | undefined): string {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.alloc(0);
  return createHash('sha256').update(data).digest('hex');
}

export function buildSignedPayload(input: {
  timestamp: string;
  method: string;
  pathAndQuery: string;
  rawBody?: Buffer;
}): string {
  return [
    input.timestamp,
    input.method.toUpperCase(),
    input.pathAndQuery,
    sha256Hex(input.rawBody),
  ].join('\n');
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function parseUnixMillis(value: string): number | null {
  if (!/^\d{1,16}$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

export function timestampWithinWindow(timestampMs: number, nowMs: number): boolean {
  if (!Number.isFinite(timestampMs) || !Number.isFinite(nowMs)) return false;
  return Math.abs(nowMs - timestampMs) <= CLIENT_SIGNATURE_WINDOW_MS;
}

export function signaturesMatch(provided: string, expected: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(provided) || !/^[0-9a-f]{64}$/i.test(expected)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}

function comparableHost(domain: string): string {
  const bracket = domain.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket) return bracket[1].toLowerCase();
  const split = splitHostAndPort(domain);
  return (split?.host ?? domain).toLowerCase();
}

function splitHostAndPort(domain: string): { host: string } | null {
  if (domain.startsWith('[')) {
    const match = domain.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (!match || (match[2] !== undefined && !isPort(match[2]))) return null;
    return { host: match[1] };
  }
  const colonCount = domain.split(':').length - 1;
  if (colonCount > 1) return { host: domain };
  if (colonCount === 1) {
    const colon = domain.lastIndexOf(':');
    const host = domain.slice(0, colon);
    const port = domain.slice(colon + 1);
    if (!host || !isPort(port)) return null;
    return { host };
  }
  return { host: domain };
}

function isPort(value: string): boolean {
  if (!/^[1-9]\d{0,4}$/.test(value)) return false;
  return Number(value) <= 65535;
}
