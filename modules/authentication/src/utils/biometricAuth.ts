import crypto from 'crypto';

export const BIOMETRIC_CHALLENGE_TTL_MS = 2 * 60 * 1000;

export function isBiometricChallengeExpired(
  createdAt: Date | string,
  now = Date.now(),
): boolean {
  return now - new Date(createdAt).getTime() > BIOMETRIC_CHALLENGE_TTL_MS;
}

export function verifyBiometricSignature(
  publicKeyDerBase64: string,
  challenge: string,
  signatureBase64: string,
): boolean {
  const verifier = crypto.createVerify('sha256WithRSAEncryption');
  verifier.update(new Uint8Array(Buffer.from(challenge)));
  const cryptoKey = crypto.createPublicKey({
    key: publicKeyDerBase64,
    format: 'der',
    type: 'spki',
    encoding: 'base64',
  });
  return verifier.verify(cryptoKey, signatureBase64, 'base64');
}
