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
  hostFromHeader,
  parseUnixMillis,
  requestHostname,
  resolveClientSecretEncryptionKey,
  signaturesMatch,
  timestampWithinWindow,
} from '../clientValidation.logic.js';

type RejectionWarn = (message: string) => void;

const logRejection: RejectionWarn = message => {
  ConduitGrpcSdk.Logger.warn(message);
};

export async function validateClient(
  req: Request,
  client: {
    platform: string;
    domain?: string;
    clientSecret: string;
  },
  clientId?: string,
  warn: RejectionWarn = logRejection,
) {
  if (client.platform === PlatformTypesEnum.WEB && client.domain) {
    if (client.domain === '*') return true;
    const host = requestHostname(
      headerText(req.headers.origin),
      hostFromHeader(headerText(req.headers.host)),
    );
    return domainAllowsHost(client.domain, host);
  }
  return verifySignedRequest(req, client.clientSecret, clientId, warn);
}

function verifySignedRequest(
  req: Request,
  ciphertext: string,
  clientId: string | undefined,
  warn: RejectionWarn,
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
    warn(`Client signature rejected: clock drift${who}`);
    return false;
  }
  if (
    ciphertext.startsWith('$2a$') ||
    ciphertext.startsWith('$2b$') ||
    ciphertext.startsWith('$2y$')
  ) {
    warn(
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
      warn('Client signature rejected: decrypt failure / wrong key');
      return false;
    }
    secret = decryptClientSecret(ciphertext, clientSecretKeyBytes(resolved));
  } catch {
    warn('Client signature rejected: decrypt failure / wrong key');
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
    warn('Client signature rejected: bad signature');
    return false;
  }
  return true;
}

function headerText(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
