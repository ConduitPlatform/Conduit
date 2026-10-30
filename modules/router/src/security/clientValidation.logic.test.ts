import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import { ConfigController } from '@conduitplatform/module-tools';
import {
  ConduitError,
  ConduitGrpcSdk,
  ParsedRouterRequest,
  PlatformTypesEnum,
} from '@conduitplatform/grpc-sdk';
import { ConduitRequest } from '@conduitplatform/hermes';
import { Response } from 'express';
import routerConfig from '../config/config.js';
import { Client } from '../models/index.js';
import { SecurityAdmin } from '../admin/security.js';
import { ClientValidator } from './handlers/client-validation/index.js';
import {
  buildSignedPayload,
  CLIENT_SIGNATURE_WINDOW_MS,
  clientSecretKeyBytes,
  decryptClientSecret,
  domainAllowsHost,
  encryptClientSecret,
  hmacSha256Hex,
  hostnameFromOrigin,
  isAcceptableClientDomain,
  requestHostname,
  sha256Hex,
  signaturesMatch,
  timestampWithinWindow,
} from './clientValidation.logic.js';

const KEY = '0123456789abcdef0123456789abcdef';
const EMPTY_BODY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

type FindCall = { query: Record<string, unknown>; options?: unknown };

let findOneResult: unknown = null;
let created: Record<string, unknown> | undefined;
const findOneCalls: FindCall[] = [];
const redis = new Map<string, string>();
const cacheWrites: { key: string; value: string; expiry?: number }[] = [];
const cleared: string[] = [];

const state = {
  getKey(key: string) {
    return Promise.resolve(redis.has(key) ? redis.get(key) : null);
  },
  setKey(key: string, value: string, expiry?: number) {
    redis.set(key, value);
    cacheWrites.push({ key, value, expiry });
    return Promise.resolve('OK');
  },
  clearKey(key: string) {
    redis.delete(key);
    cleared.push(key);
    return Promise.resolve(1);
  },
};

function installModel() {
  Client.getInstance = (() => ({
    findOne: async (query: Record<string, unknown>, options?: unknown) => {
      findOneCalls.push({ query, options });
      return findOneResult;
    },
    create: async (doc: Record<string, unknown>) => {
      created = doc;
      return { ...doc, _id: 'created-id' };
    },
    deleteOne: async () => ({ deletedCount: 1 }),
    findMany: async () => [],
    findByIdAndUpdate: async () => ({}),
  })) as unknown as typeof Client.getInstance;
}

function useConfig(clientValidation = true) {
  ConfigController.getInstance().config = {
    env: 'development',
    security: {
      clientValidation,
      clientSecretEncryptionKey: KEY,
    },
  };
}

function requestOf(init: {
  headers?: Record<string, string | undefined>;
  method?: string;
  originalUrl?: string;
  hostname?: string;
  rawBody?: Buffer;
  url?: string;
  path?: string;
}): ConduitRequest {
  const headers: Record<string, string | undefined> = { ...(init.headers ?? {}) };
  const originalUrl = init.originalUrl ?? '/database/orders?limit=1';
  return {
    headers,
    method: init.method ?? 'POST',
    path: init.path ?? originalUrl.split('?')[0],
    url: init.url ?? originalUrl,
    originalUrl,
    hostname: init.hostname ?? 'router.internal',
    rawBody: init.rawBody,
    conduit: {},
    get(name: string) {
      if (name.toLowerCase() === 'origin') return headers.origin;
      return undefined;
    },
  } as unknown as ConduitRequest;
}

function signedRequest(input: {
  secret: string;
  timestamp?: string;
  method?: string;
  pathAndQuery?: string;
  rawBody?: Buffer;
  signature?: string;
  extraHeaders?: Record<string, string | undefined>;
}) {
  const timestamp = input.timestamp ?? String(Date.now());
  const method = input.method ?? 'POST';
  const pathAndQuery = input.pathAndQuery ?? '/database/orders?limit=1';
  const rawBody = input.rawBody ?? Buffer.from('{"a":1}');
  const payload = buildSignedPayload({
    timestamp,
    method,
    pathAndQuery,
    rawBody,
  });
  return requestOf({
    method,
    originalUrl: pathAndQuery,
    rawBody,
    headers: {
      clientid: 'cid-1',
      'x-conduit-timestamp': timestamp,
      'x-conduit-signature': input.signature ?? hmacSha256Hex(input.secret, payload),
      ...input.extraHeaders,
    },
  });
}

function errorShape(error: unknown) {
  const err = error as { name?: string; status?: number; message?: string };
  return { name: err.name, status: err.status, message: err.message };
}

async function runMiddleware(req: ConduitRequest) {
  const validator = new ClientValidator({
    state,
    database: {},
  } as unknown as ConduitGrpcSdk);
  let error: unknown;
  await validator.middleware(req, {} as Response, (err?: unknown) => {
    error = err;
  });
  return error;
}

describe('client validation rules', () => {
  it('compares the hostname with and without a scheme or port', () => {
    assert.equal(hostnameFromOrigin('https://app.example.com'), 'app.example.com');
    assert.equal(hostnameFromOrigin('app.example.com'), 'app.example.com');
    assert.equal(hostnameFromOrigin('https://app.example.com:8443'), 'app.example.com');
    assert.equal(hostnameFromOrigin('http://localhost:3000'), 'localhost');
    assert.equal(requestHostname(undefined, 'App.Example.com'), 'app.example.com');
    assert.equal(domainAllowsHost('app.example.com', 'app.example.com'), true);
    assert.equal(
      domainAllowsHost('app.example.com', 'app.example.com'.toUpperCase()),
      true,
    );
  });

  it('accepts only a leading wildcard and requires the dot', () => {
    assert.equal(domainAllowsHost('*.example.com', 'a.example.com'), true);
    assert.equal(domainAllowsHost('*.example.com', 'A.Example.COM'), true);
    assert.equal(domainAllowsHost('*.example.com', 'example.com'), false);
    assert.equal(domainAllowsHost('*.example.com', 'evilexample.com'), false);
    assert.equal(isAcceptableClientDomain('*.example.com'), true);
    assert.equal(isAcceptableClientDomain('*example.com'), false);
    assert.equal(isAcceptableClientDomain('foo.*.example.com'), false);
    assert.equal(isAcceptableClientDomain('*.*.example.com'), false);
    assert.equal(isAcceptableClientDomain('*'), true);
  });

  it('accepts localhost, IP addresses, and an optional port', () => {
    assert.equal(isAcceptableClientDomain('localhost'), true);
    assert.equal(isAcceptableClientDomain('localhost:3000'), true);
    assert.equal(isAcceptableClientDomain('127.0.0.1'), true);
    assert.equal(isAcceptableClientDomain('127.0.0.1:8080'), true);
    assert.equal(isAcceptableClientDomain('[::1]'), true);
    assert.equal(isAcceptableClientDomain('[::1]:3000'), true);
    assert.equal(isAcceptableClientDomain('::1'), true);
    assert.equal(isAcceptableClientDomain(''), false);
    assert.equal(isAcceptableClientDomain('http://localhost'), false);
  });

  it('builds the HMAC string and the empty-body hash', () => {
    const body = Buffer.from('{"a":1}');
    const payload = buildSignedPayload({
      timestamp: '1000',
      method: 'post',
      pathAndQuery: '/database/orders?limit=1',
      rawBody: body,
    });
    assert.equal(payload, `1000\nPOST\n/database/orders?limit=1\n${sha256Hex(body)}`);
    assert.equal(payload.includes('\r'), false);
    assert.equal(sha256Hex(undefined), EMPTY_BODY_SHA256);
    assert.equal(sha256Hex(Buffer.alloc(0)), EMPTY_BODY_SHA256);
  });

  it('rejects a timestamp outside five minutes in either direction', () => {
    const now = 1_700_000_000_000;
    assert.equal(timestampWithinWindow(now, now), true);
    assert.equal(timestampWithinWindow(now - CLIENT_SIGNATURE_WINDOW_MS, now), true);
    assert.equal(timestampWithinWindow(now + CLIENT_SIGNATURE_WINDOW_MS, now), true);
    assert.equal(timestampWithinWindow(now - CLIENT_SIGNATURE_WINDOW_MS - 1, now), false);
    assert.equal(timestampWithinWindow(now + CLIENT_SIGNATURE_WINDOW_MS + 1, now), false);
  });

  it('breaks the signature when the body, path, or method changes', () => {
    const secret = 'signing-secret';
    const base = {
      timestamp: '1000',
      method: 'POST',
      pathAndQuery: '/database/orders?limit=1',
      rawBody: Buffer.from('{"a":1}'),
    };
    const signature = hmacSha256Hex(secret, buildSignedPayload(base));
    const changedBody = hmacSha256Hex(
      secret,
      buildSignedPayload({ ...base, rawBody: Buffer.from('{"a":2}') }),
    );
    const changedPath = hmacSha256Hex(
      secret,
      buildSignedPayload({ ...base, pathAndQuery: '/database/orders?limit=2' }),
    );
    const changedMethod = hmacSha256Hex(
      secret,
      buildSignedPayload({ ...base, method: 'PUT' }),
    );
    assert.equal(signaturesMatch(signature, signature), true);
    assert.equal(signaturesMatch(changedBody, signature), false);
    assert.equal(signaturesMatch(changedPath, signature), false);
    assert.equal(signaturesMatch(changedMethod, signature), false);
  });

  it('rejects a signature that is not 64 hex characters without throwing', () => {
    const expected = 'a'.repeat(64);
    assert.equal(signaturesMatch('abcd', expected), false);
    assert.equal(signaturesMatch('g'.repeat(64), expected), false);
    assert.equal(signaturesMatch('a'.repeat(63), expected), false);
    assert.equal(signaturesMatch('a'.repeat(65), expected), false);
    assert.equal(signaturesMatch(expected, expected), true);
  });

  it('returns the original secret after encrypting and decrypting', () => {
    const key = clientSecretKeyBytes(KEY);
    const secret = 'one-time-client-secret';
    const blob = encryptClientSecret(secret, key);
    assert.equal(decryptClientSecret(blob, key), secret);
    assert.notEqual(blob, secret);
  });
});

describe('security client handlers', () => {
  const plaintext = 'plain-client-secret';
  let ciphertext = '';

  beforeEach(() => {
    findOneResult = null;
    created = undefined;
    findOneCalls.length = 0;
    redis.clear();
    cacheWrites.length = 0;
    cleared.length = 0;
    ciphertext = encryptClientSecret(plaintext, clientSecretKeyBytes(KEY));
    installModel();
    useConfig(true);
  });

  it('loads the Mongo secret with +clientSecret', async () => {
    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.ANDROID,
      domain: '',
    };
    const error = await runMiddleware(signedRequest({ secret: plaintext }));
    assert.equal(error, undefined);
    assert.deepEqual(findOneCalls[0]?.options, {
      select: '+clientSecret platform domain',
      readPreference: 'primary',
    });
  });

  it('accepts a valid signature and caches ciphertext, not the secret', async () => {
    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.ANDROID,
      domain: '',
    };
    const req = signedRequest({ secret: plaintext });
    const error = await runMiddleware(req);
    assert.equal(error, undefined);
    assert.equal(req.conduit?.clientId, 'cid-1');
    assert.equal(req.headers['x-conduit-signature'], undefined);
    assert.equal(req.headers.clientsecret, undefined);
    assert.equal(cacheWrites.length, 1);
    assert.equal(cacheWrites[0]?.expiry, 100000);
    const cached = JSON.parse(cacheWrites[0]!.value) as {
      c: string;
      p: string;
      d: string;
    };
    assert.equal(cached.c, ciphertext);
    assert.equal(cached.p, PlatformTypesEnum.ANDROID);
    assert.equal(cached.d, '');
    assert.equal(cacheWrites[0]!.value.includes(plaintext), false);
  });

  it('accepts a replay inside five minutes and rejects an older one', async () => {
    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.ANDROID,
    };
    const recent = String(Date.now() - 60_000);
    const first = await runMiddleware(
      signedRequest({ secret: plaintext, timestamp: recent }),
    );
    const second = await runMiddleware(
      signedRequest({ secret: plaintext, timestamp: recent }),
    );
    assert.equal(first, undefined);
    assert.equal(second, undefined);

    const stale = String(Date.now() - CLIENT_SIGNATURE_WINDOW_MS - 1);
    const staleError = await runMiddleware(
      signedRequest({ secret: plaintext, timestamp: stale }),
    );
    assert.deepEqual(errorShape(staleError), {
      name: 'UNAUTHORIZED',
      status: 401,
      message: 'Unauthorized',
    });
  });

  it('rejects a future timestamp, a wrong signature, and a short signature', async () => {
    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.ANDROID,
    };
    const future = String(Date.now() + CLIENT_SIGNATURE_WINDOW_MS + 10_000);
    const futureError = await runMiddleware(
      signedRequest({ secret: plaintext, timestamp: future }),
    );
    const wrong = signedRequest({ secret: plaintext });
    wrong.headers['x-conduit-signature'] = 'b'.repeat(64);
    const wrongError = await runMiddleware(wrong);
    const shortError = await runMiddleware(
      signedRequest({ secret: plaintext, signature: 'abcd' }),
    );
    const unauthorized = {
      name: 'UNAUTHORIZED',
      status: 401,
      message: 'Unauthorized',
    };
    assert.deepEqual(errorShape(futureError), unauthorized);
    assert.deepEqual(errorShape(wrongError), unauthorized);
    assert.deepEqual(errorShape(shortError), unauthorized);
  });

  it('rejects a clientSecret header and uses that same unauthorized error for an unknown client', async () => {
    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.ANDROID,
    };
    const withSecret = signedRequest({
      secret: plaintext,
      extraHeaders: { clientsecret: plaintext },
    });
    const secretError = await runMiddleware(withSecret);
    assert.equal(findOneCalls.length, 0);
    assert.equal(withSecret.headers.clientsecret, undefined);
    assert.equal(withSecret.headers['x-conduit-signature'], undefined);

    findOneResult = null;
    const unknownError = await runMiddleware(signedRequest({ secret: plaintext }));
    assert.deepEqual(errorShape(secretError), errorShape(unknownError));
    assert.deepEqual(errorShape(unknownError), {
      name: 'UNAUTHORIZED',
      status: 401,
      message: 'Unauthorized',
    });
    assert.equal(secretError instanceof ConduitError, true);
  });

  it('falls through to the database when the cache value does not parse', async () => {
    redis.set('cid-1', 'secret,ANDROID,');
    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.ANDROID,
    };
    const error = await runMiddleware(signedRequest({ secret: plaintext }));
    assert.equal(error, undefined);
    assert.equal(findOneCalls.length, 1);
  });

  it('accepts a cached client and still removes the signature header', async () => {
    redis.set(
      'cid-1',
      JSON.stringify({ c: ciphertext, p: PlatformTypesEnum.ANDROID, d: '' }),
    );
    const req = signedRequest({ secret: plaintext });
    const error = await runMiddleware(req);
    assert.equal(error, undefined);
    assert.equal(findOneCalls.length, 0);
    assert.equal(req.headers['x-conduit-signature'], undefined);
    assert.equal(req.conduit?.clientId, 'cid-1');
  });

  it('matches a web origin by hostname and allows localhost', async () => {
    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.WEB,
      domain: 'app.example.com',
    };
    const fromOrigin = requestOf({
      headers: { clientid: 'cid-1', origin: 'https://app.example.com' },
      method: 'GET',
      originalUrl: '/database/orders',
    });
    assert.equal(await runMiddleware(fromOrigin), undefined);

    findOneCalls.length = 0;
    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.WEB,
      domain: 'app.example.com',
    };
    const bareHost = requestOf({
      headers: { clientid: 'cid-1', origin: 'app.example.com:443' },
      hostname: 'other.example',
      originalUrl: '/database/orders',
    });
    assert.equal(await runMiddleware(bareHost), undefined);

    findOneResult = {
      clientSecret: ciphertext,
      platform: PlatformTypesEnum.WEB,
      domain: 'localhost',
    };
    const local = requestOf({
      headers: { clientid: 'cid-1' },
      hostname: 'localhost',
      originalUrl: '/database/orders',
    });
    assert.equal(await runMiddleware(local), undefined);
  });

  it('stores a 43 character secret encrypted and returns the plaintext once', async () => {
    const admin = new SecurityAdmin({ state } as unknown as ConduitGrpcSdk);
    const createdClient = (await admin.createSecurityClient({
      request: { params: { platform: PlatformTypesEnum.ANDROID } },
    } as unknown as ParsedRouterRequest)) as { clientSecret: string };
    const returned = createdClient.clientSecret;
    const stored = created!.clientSecret as string;
    assert.equal(returned.length, 43);
    assert.match(returned, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(stored, returned);
    assert.equal(decryptClientSecret(stored, clientSecretKeyBytes(KEY)), returned);
  });

  it('accepts localhost and a leading wildcard, and rejects any other star', () => {
    const admin = new SecurityAdmin({ state } as unknown as ConduitGrpcSdk);
    assert.doesNotThrow(() => admin.validateDomain('localhost'));
    assert.doesNotThrow(() => admin.validateDomain('127.0.0.1:8080'));
    assert.doesNotThrow(() => admin.validateDomain('[::1]'));
    assert.doesNotThrow(() => admin.validateDomain('*.example.com'));
    assert.throws(() => admin.validateDomain('evilexample.*.com'), {
      message: 'Invalid domain argument',
    });
    assert.throws(() => admin.validateDomain(''), {
      message: 'Platform WEB requires domain name',
    });
  });

  it('clears the redis key on delete', async () => {
    findOneResult = { _id: 'mongo-id', clientId: 'cid-1' };
    const admin = new SecurityAdmin({ state } as unknown as ConduitGrpcSdk);
    const result = await admin.deleteSecurityClient({
      request: { params: { id: 'mongo-id' } },
    } as unknown as ParsedRouterRequest);
    assert.deepEqual(result, { message: 'Client deleted' });
    assert.deepEqual(cleared, ['cid-1']);
  });

  it('does not validate router config when the encryption key is missing or not 32 bytes', () => {
    const missing = convict(routerConfig);
    assert.throws(() => missing.validate({ allowed: 'warn' }), /32 bytes/);

    const shortKey = convict(routerConfig);
    shortKey.set('security.clientSecretEncryptionKey', 'short-key');
    assert.throws(() => shortKey.validate({ allowed: 'warn' }), /32 bytes/);

    const present = convict(routerConfig);
    present.set('security.clientSecretEncryptionKey', KEY);
    assert.doesNotThrow(() => present.validate({ allowed: 'warn' }));
    assert.equal(routerConfig.security.clientSecretEncryptionKey.sensitive, true);
  });
});
