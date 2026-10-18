import { createHash } from 'crypto';

/*
 * Pure rules for per-realm OAuth settings (no database or grpc access): credential
 * completeness, the cache version of an effective credential set, and the per-handler
 * settings cache. IO lives in ../OAuth2.ts.
 */

/** The credential part of a provider's effective settings (global or realm). */
export type OAuthCredentials = {
  clientId?: string | null;
  clientSecret?: string | null;
  redirect_uri?: string | null;
  accountLinking?: boolean | null;
  privateKey?: string | null;
  teamId?: string | null;
  keyId?: string | null;
};

function filled(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Whether a credential set can drive a login. Apple signs a client secret from its key
 * triple, every other provider needs a client secret.
 */
export function hasCompleteOAuthCredentials(
  providerName: string,
  credentials: OAuthCredentials | null | undefined,
): boolean {
  if (!credentials || !filled(credentials.clientId)) return false;
  if (providerName === 'apple') {
    return (
      filled(credentials.privateKey) &&
      filled(credentials.teamId) &&
      filled(credentials.keyId)
    );
  }
  return filled(credentials.clientSecret);
}

/**
 * Whether the global module config makes a provider available (enabled with complete
 * credentials). This is what `validate()` always checked.
 */
export function isGlobalOAuthAvailable(
  providerName: string,
  globalConfig: (OAuthCredentials & { enabled?: boolean }) | null | undefined,
): boolean {
  return (
    globalConfig?.enabled === true &&
    hasCompleteOAuthCredentials(providerName, globalConfig)
  );
}

/**
 * Version of a credential set: changes whenever a credential the settings are built
 * from changes (secrets are hashed, never used as-is).
 */
export function oauthSettingsVersion(credentials: OAuthCredentials): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        credentials.clientId ?? '',
        credentials.clientSecret ?? '',
        credentials.redirect_uri ?? '',
        credentials.accountLinking ?? null,
        credentials.privateKey ?? '',
        credentials.teamId ?? '',
        credentials.keyId ?? '',
      ]),
    )
    .digest('hex');
}

// Bumped by invalidateOAuthSettingsCache(); every cache drops its entries on a change.
let settingsCacheGeneration = 0;

/**
 * Drops the cached per-realm OAuth settings of every handler. Called whenever the realm
 * cache is invalidated (realm writes, bus events), so a changed realm never keeps
 * serving old credentials. Entries are also keyed by credential version, which
 * covers changes of the inherited global credentials.
 */
export function invalidateOAuthSettingsCache(): void {
  settingsCacheGeneration++;
}

/** Realm id -> settings, one entry per realm, rebuilt when the version changes. */
export class OAuthSettingsCache<T> {
  private entries = new Map<string, { version: string; value: T }>();
  private generation = settingsCacheGeneration;

  constructor(private readonly maxEntries = 500) {}

  get(realmId: string, version: string, build: () => T): T {
    if (this.generation !== settingsCacheGeneration) {
      this.entries.clear();
      this.generation = settingsCacheGeneration;
    }
    const cached = this.entries.get(realmId);
    if (cached && cached.version === version) return cached.value;
    const value = build();
    if (!cached && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(realmId, { version, value });
    return value;
  }

  get size(): number {
    return this.entries.size;
  }
}
