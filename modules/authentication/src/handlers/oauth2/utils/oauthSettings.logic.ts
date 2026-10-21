import { filled } from '../../../utils/common.logic.js';

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
 * from changes. It is an in-memory cache key only, compared for equality and never
 * logged or stored.
 */
export function oauthSettingsVersion(credentials: OAuthCredentials): string {
  return JSON.stringify([
    credentials.clientId ?? '',
    credentials.clientSecret ?? '',
    credentials.redirect_uri ?? '',
    credentials.accountLinking ?? null,
    credentials.privateKey ?? '',
    credentials.teamId ?? '',
    credentials.keyId ?? '',
  ]);
}

// Bumped by invalidateOAuthSettingsCache(); every cache drops its entries on a change.
let settingsCacheGeneration = 0;

/**
 * Drops the cached per-realm OAuth settings of every handler. Called whenever the realm
 * cache is invalidated (realm writes, bus events, and a change of the global module
 * config, see `Authentication.onConfig`), so a changed realm never keeps serving old
 * credentials.
 *
 * Entries are keyed by the credential version of the realm's *effective* settings, which
 * are built from the cached realm context. A rotation of the inherited global
 * credentials is therefore only visible once that context is rebuilt: the config change
 * handler must invalidate the realm cache (which calls this), the version key alone does
 * not cover it.
 */
export function invalidateOAuthSettingsCache(): void {
  settingsCacheGeneration++;
}

/**
 * Where the OAuth callback of a realm flow takes its realm from. New state tokens carry
 * the realm team id (`realmId`, survives a slug rename mid-flow) next to the slug
 * (`realm`); tokens created before that only have the slug. The id wins when present.
 */
export function stateRealmRef(
  data: { realmId?: unknown; realm?: unknown } | null | undefined,
): { id: string } | { slug: string } | null {
  const id = data?.realmId;
  if (typeof id === 'string' && id !== '') return { id };
  if (typeof id === 'number') return { id: String(id) };
  const slug = data?.realm;
  if (typeof slug === 'string' && slug !== '') return { slug };
  return null;
}

/**
 * Redirect target for an OAuth callback that fails before the realm is known: the first
 * non-empty candidate, in order of precedence (validated `customRedirectUri`, the
 * realm's `redirect_uri`, the global `finalRedirect`).
 */
export function pickCallbackRedirect(
  candidates: ReadonlyArray<string | null | undefined>,
): string | undefined {
  return candidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim() !== '',
  );
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

/**
 * The settings a request runs with: the handler's global settings without a realm, else
 * the realm's, built from its effective credentials and cached per realm id and
 * credential version. A realm without an entry for the provider fails closed through
 * `missing` (it must never fall back to the global credentials).
 */
export function settingsForRealm<S, E extends OAuthCredentials>(params: {
  globalSettings: S;
  realm: { id: string; effective: E | null | undefined } | null;
  cache: OAuthSettingsCache<S>;
  build: (effective: E) => S;
  missing: () => Error;
}): S {
  const { realm } = params;
  if (!realm) return params.globalSettings;
  const effective = realm.effective;
  if (!effective) throw params.missing();
  return params.cache.get(realm.id, oauthSettingsVersion(effective), () =>
    params.build(effective),
  );
}
