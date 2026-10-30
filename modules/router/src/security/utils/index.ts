import { Request } from 'express';
import { PlatformTypesEnum } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { ConduitRequest } from '@conduitplatform/hermes';
import {
  buildSignedPayload,
  clientSecretKeyBytes,
  decryptClientSecret,
  domainAllowsHost,
  hmacSha256Hex,
  parseUnixMillis,
  requestHostname,
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
) {
  if (client.platform === PlatformTypesEnum.WEB && client.domain) {
    if (client.domain === '*') return true;
    const host = requestHostname(req.get('origin') ?? undefined, req.hostname);
    return domainAllowsHost(client.domain, host);
  }
  return verifySignedRequest(req, client.clientSecret);
}

function verifySignedRequest(req: Request, ciphertext: string): boolean {
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
    return false;
  }
  let secret: string;
  try {
    const key = clientSecretKeyBytes(
      ConfigController.getInstance().config.security.clientSecretEncryptionKey,
    );
    secret = decryptClientSecret(ciphertext, key);
  } catch {
    return false;
  }
  const conduitReq = req as ConduitRequest;
  const payload = buildSignedPayload({
    timestamp: timestampHeader,
    method: req.method,
    pathAndQuery: req.originalUrl,
    rawBody: conduitReq.rawBody,
  });
  return signaturesMatch(signatureHeader, hmacSha256Hex(secret, payload));
}
