import { BlockList, isIP } from 'node:net';
import { lookup as defaultLookup } from 'node:dns/promises';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const DEFAULT_EMBED_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_EMBED_INPUT_BYTES = 32 * 1024;
export const DEFAULT_MAX_EMBED_RESPONSE_BYTES = 1024 * 1024;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.google.com',
]);

const privateNetworks = new BlockList();
privateNetworks.addSubnet('0.0.0.0', 8, 'ipv4');
privateNetworks.addSubnet('10.0.0.0', 8, 'ipv4');
privateNetworks.addSubnet('100.64.0.0', 10, 'ipv4');
privateNetworks.addSubnet('127.0.0.0', 8, 'ipv4');
privateNetworks.addSubnet('169.254.0.0', 16, 'ipv4');
privateNetworks.addSubnet('172.16.0.0', 12, 'ipv4');
privateNetworks.addSubnet('192.168.0.0', 16, 'ipv4');
privateNetworks.addSubnet('::1', 128, 'ipv6');
privateNetworks.addAddress('::', 'ipv6');
privateNetworks.addSubnet('fc00::', 7, 'ipv6');
privateNetworks.addSubnet('fe80::', 10, 'ipv6');

export interface SafeEndpointOptions {
  lookup?: (
    hostname: string,
    options: { all: true; verbatim: true },
  ) => Promise<Array<{ address: string; family: number }>>;
}

export function isBlockedIp(address: string): boolean {
  const mapped = address.startsWith('::ffff:') ? address.slice(7) : address;
  const ipVersion = isIP(mapped);
  if (ipVersion === 4) return privateNetworks.check(mapped, 'ipv4');
  if (ipVersion === 6) return privateNetworks.check(mapped, 'ipv6');
  return true;
}

export async function assertSafeEmbeddingEndpoint(
  endpoint: string,
  options: SafeEndpointOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Embedding provider endpoint is invalid',
    );
  }
  if (url.protocol !== 'https:') {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Embedding provider endpoint must use HTTPS',
    );
  }
  if (url.username || url.password) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Embedding provider endpoint must not include credentials',
    );
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Embedding provider endpoint host is not allowed',
    );
  }
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Embedding provider endpoint resolves to a blocked address',
      );
    }
    return url;
  }
  const lookup = options.lookup ?? defaultLookup;
  const resolved = await lookup(hostname, { all: true, verbatim: true });
  const records = Array.isArray(resolved) ? resolved : [resolved];
  if (!records.length) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'Embedding provider endpoint host could not be resolved',
    );
  }
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Embedding provider endpoint resolves to a blocked address',
      );
    }
  }
  return url;
}

export async function readCappedResponse(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) {
      throw new GrpcError(
        status.RESOURCE_EXHAUSTED,
        'Embedding provider response is too large',
      );
    }
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new GrpcError(
        status.RESOURCE_EXHAUSTED,
        'Embedding provider response is too large',
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
