import crypto from 'node:crypto';

/** PEM-encoded Ed25519 signing keys, as stored in `accessTokens.signing`. */
export type SigningConfig = {
  kid: string;
  publicKey: string;
  privateKey: string;
  previousKid: string;
  previousPublicKey: string;
  /** absolute ms epoch after which the previous key is no longer accepted; 0 = none */
  previousRetiredAt: number;
};

export type SigningKeypair = Pick<SigningConfig, 'kid' | 'publicKey' | 'privateKey'>;

export function emptySigning(): SigningConfig {
  return {
    kid: '',
    publicKey: '',
    privateKey: '',
    previousKid: '',
    previousPublicKey: '',
    previousRetiredAt: 0,
  };
}

function blank(value?: string | null): boolean {
  return !value?.trim();
}

/** The current keypair is missing (any of kid, publicKey, privateKey is blank). */
export function isSigningEmpty(signing?: Partial<SigningConfig> | null): boolean {
  return blank(signing?.kid) || blank(signing?.publicKey) || blank(signing?.privateKey);
}

/** Key id derived from the public key, so it is stable and unique per keypair. */
export function keyIdOf(publicKeyPem: string): string {
  return crypto.createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 16);
}

export function generateSigningKeypair(): SigningKeypair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { kid: keyIdOf(publicKey), publicKey, privateKey };
}

/** Fills the current keypair when empty; a present keypair (and previous block) is kept. */
export function ensureSigning(signing?: Partial<SigningConfig> | null): SigningConfig {
  const base = { ...emptySigning(), ...signing };
  if (!isSigningEmpty(base)) return base;
  return { ...base, ...generateSigningKeypair() };
}

/**
 * Mints a new current keypair and moves the old one to `previous`. The previous key stays
 * valid until `previousRetiredAt` = now + 2 * accessExpiry (absolute ms epoch), so tokens
 * signed just before the rotation outlive it. An empty current keypair is just minted.
 */
export function rotate(
  signing: Partial<SigningConfig> | null | undefined,
  now: number,
  accessExpiryMs: number,
): SigningConfig {
  const current = { ...emptySigning(), ...signing };
  const next = generateSigningKeypair();
  if (isSigningEmpty(current)) return { ...emptySigning(), ...next };
  return {
    ...next,
    previousKid: current.kid,
    previousPublicKey: current.publicKey,
    previousRetiredAt: now + 2 * accessExpiryMs,
  };
}

/** Whether the previous key may still verify tokens at `now`. */
export function previousKeyActive(
  signing: Partial<SigningConfig> | null | undefined,
  now: number,
): boolean {
  return (
    !blank(signing?.previousPublicKey) &&
    typeof signing?.previousRetiredAt === 'number' &&
    signing.previousRetiredAt > now
  );
}
