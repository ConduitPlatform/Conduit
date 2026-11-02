import { Request } from 'express';
import { ConduitGrpcSdk, PlatformTypesEnum } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { ConduitRequest, isSocketHandshake } from '@conduitplatform/hermes';
import {
  buildSignedPayload,
  clientSecretKeyBytes,
  clientSecretKeyError,
  decryptClientSecret,
  domainAllowsHost,
  hmacSha256Hex,
  parseUnixMillis,
  requestHostname,
  resolveClientSecretEncryptionKey,
  signaturesMatch,
  timestampWithinWindow,
} from '../clientValidation.logic.js';

export async function validateClient(
  req: Request,
  client: {
    platform: string;
    domain?: string;
    clientSecret: string;
  },
  clientId?: string,
) {
  if (client.platform === PlatformTypesEnum.WEB && client.domain) {
    if (client.domain === '*') return true;
    const host = requestHostname(req.get('origin') ?? undefined, req.hostname);
    return domainAllowsHost(client.domain, host);
  }
  return verifySignedRequest(req, client.clientSecret, clientId);
}

function verifySignedRequest(
  req: Request,
  ciphertext: string,
  clientId?: string,
): boolean {
  const signatureHeader = req.headers['x-conduit-signature'];
  const timestampHeader = req.headers['x-conduit-timestamp'];
  if (typeof signatureHeader !== 'string' || typeof timestampHeader !== 'string') {
    return false;
  }
  if (!/^[0-9a-f]{64}$/i.test(signatureHeader)) {
    return false;
  }
  const timestamp = parseUnixMillis(timestampHeader);
  if (timestamp === null || !timestampWithinWindow(timestamp, Date.now())) {
    const who = clientId ? ` for client ${clientId}` : '';
    ConduitGrpcSdk.Logger.warn(`Client signature rejected: clock drift${who}`);
    return false;
  }
  if (
    ciphertext.startsWith('$2a$') ||
    ciphertext.startsWith('$2b$') ||
    ciphertext.startsWith('$2y$')
  ) {
    ConduitGrpcSdk.Logger.warn(
      'Client signature rejected: this client is an old bcrypt secret and must be recreated',
    );
    return false;
  }
  let secret: string;
  try {
    const resolved = resolveClientSecretEncryptionKey(
      ConfigController.getInstance().config.security.clientSecretEncryptionKey,
    );
    if (resolved === '' || clientSecretKeyError(resolved)) {
      ConduitGrpcSdk.Logger.warn(
        'Client signature rejected: decrypt failure / wrong key',
      );
      return false;
    }
    secret = decryptClientSecret(ciphertext, clientSecretKeyBytes(resolved));
  } catch {
    ConduitGrpcSdk.Logger.warn('Client signature rejected: decrypt failure / wrong key');
    return false;
  }
  const conduitReq = req as ConduitRequest;
  const prefix =
    ConfigController.getInstance().config.security.clientSignaturePathPrefix ?? '';
  const pathAndQuery = isSocketHandshake(req)
    ? prefix + (req.path ?? '')
    : prefix + (req.originalUrl ?? '');
  const payload = buildSignedPayload({
    timestamp: timestampHeader,
    method: req.method,
    pathAndQuery,
    rawBody: conduitReq.rawBody,
  });
  if (!signaturesMatch(signatureHeader, hmacSha256Hex(secret, payload))) {
    ConduitGrpcSdk.Logger.warn('Client signature rejected: bad signature');
    return false;
  }
  return true;
}
