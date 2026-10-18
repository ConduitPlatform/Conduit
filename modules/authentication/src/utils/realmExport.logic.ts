/**
 * Pure transforms for the GitOps export/import of realms (see
 * docs/design/authentication-realms.md, D7). No IO: unit-testable with node --test.
 *
 * Export format, per team (next to the existing name / parentTeamName / isDefault):
 *
 *   realm:         { enabled: boolean, slug?: string }
 *   realmSettings: { active, strategies, registration, policies }   // realm teams only
 *
 * `realmSettings` is the masked RealmSettings without `_id`, `team` and timestamps.
 * Secrets are never exported: every OAuth provider carries `clientSecret: null` (and
 * `privateKey: null` for apple) instead of the value or the `has*` flags. Realm team
 * ids are not portable between environments, so `policies.guests.allowedHomeRealms`
 * is exported as `allowedHomeRealmSlugs`.
 */
import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { buildRealmSettingsWrite, pickSettingsFields } from '../admin/realm.logic.js';
import {
  assertValidSlug,
  defaultRealmSettings,
  maskRealmSettings,
  RealmOAuthSecrets,
} from './realm.logic.js';

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new GrpcError(status.INVALID_ARGUMENT, message);
}

const SECRET_AND_FLAG_FIELDS = [
  'clientSecret',
  'privateKey',
  'hasClientSecret',
  'hasPrivateKey',
] as const;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ExportedTeamRealm = { enabled: boolean; slug?: string };

export function exportTeamRealm(team: Indexable): ExportedTeamRealm {
  const enabled = team.realm?.enabled === true;
  const slug = team.realm?.slug;
  return enabled && typeof slug === 'string' && slug !== ''
    ? { enabled, slug }
    : { enabled };
}

/**
 * Settings of a realm for export. `stored` is a RealmSettings document (read without
 * `oauthSecrets`, which is `select: false`); a secret that is present anyway is
 * dropped. `slugById` maps realm team ids to slugs for the trusted home realms.
 */
export function exportRealmSettings(
  stored: Indexable,
  slugById: ReadonlyMap<string, string>,
): Indexable {
  const masked = maskRealmSettings({
    ...stored,
    strategies: stored.strategies ?? { oauth: {} },
  });
  const fields = pickSettingsFields(masked) as Indexable;
  const oauth: Indexable = {};
  for (const [provider, entry] of Object.entries(
    (fields.strategies.oauth ?? {}) as Indexable,
  )) {
    const exported: Indexable = { ...entry };
    for (const field of SECRET_AND_FLAG_FIELDS) delete exported[field];
    exported.clientSecret = null;
    if (provider === 'apple') exported.privateKey = null;
    oauth[provider] = exported;
  }
  const { allowedHomeRealms, ...guests } = fields.policies.guests;
  const slugs = (allowedHomeRealms as string[])
    .map(id => slugById.get(String(id)))
    .filter((slug): slug is string => typeof slug === 'string');
  return {
    active: fields.active,
    strategies: { ...fields.strategies, oauth },
    registration: fields.registration,
    policies: {
      ...fields.policies,
      guests: { ...guests, allowedHomeRealmSlugs: slugs },
    },
  };
}

/** Realm team id -> slug for every enabled realm among the teams. */
export function buildSlugById(teams: Indexable[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const team of teams) {
    const slug = team.realm?.enabled === true ? team.realm.slug : undefined;
    if (typeof slug === 'string' && slug !== '') map.set(String(team._id), slug);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportedRealm =
  | { enabled: false }
  | {
      enabled: true;
      slug: string;
      /** settings write body: no secrets, no team ids */
      input: Indexable;
      /** slugs of the trusted home realms, resolved once every realm team exists */
      allowedHomeRealmSlugs: string[] | undefined;
    };

/** Whitelists the settings keys and drops every secret and read-only flag. */
function sanitizeImportedSettings(settings: Indexable): {
  input: Indexable;
  allowedHomeRealmSlugs: string[] | undefined;
} {
  const input: Indexable = {};
  let allowedHomeRealmSlugs: string[] | undefined;
  if (settings.active !== undefined) input.active = settings.active;
  if (settings.registration !== undefined) input.registration = settings.registration;
  if (settings.policies !== undefined) {
    if (!isRecord(settings.policies)) invalid('realmSettings.policies must be an object');
    const { guests, ...policies } = settings.policies;
    input.policies = { ...policies };
    if (guests !== undefined) {
      if (!isRecord(guests)) invalid('realmSettings.policies.guests must be an object');
      // team ids do not travel between environments: only slugs are imported
      const { allowedHomeRealms: _ids, allowedHomeRealmSlugs: slugs, ...rest } = guests;
      input.policies.guests = rest;
      if (slugs !== undefined) {
        if (!Array.isArray(slugs)) {
          invalid('realmSettings.policies.guests.allowedHomeRealmSlugs must be an array');
        }
        allowedHomeRealmSlugs = Array.from(
          new Set(slugs.map(slug => assertValidSlug(slug))),
        );
      }
    }
  }
  if (settings.strategies !== undefined) {
    if (!isRecord(settings.strategies))
      invalid('realmSettings.strategies must be an object');
    const { oauth, ...toggles } = settings.strategies;
    input.strategies = { ...toggles };
    if (oauth !== undefined) {
      if (!isRecord(oauth)) invalid('realmSettings.strategies.oauth must be an object');
      const cleanOauth: Indexable = {};
      for (const [provider, entry] of Object.entries(oauth)) {
        if (!isRecord(entry)) invalid(`strategies.oauth.${provider} must be an object`);
        const clean: Indexable = { ...entry };
        for (const field of SECRET_AND_FLAG_FIELDS) delete clean[field];
        cleanOauth[provider] = clean;
      }
      input.strategies.oauth = cleanOauth;
    }
  }
  return { input, allowedHomeRealmSlugs };
}

/**
 * Reads the `realm` / `realmSettings` of an exported team record. Throws
 * INVALID_ARGUMENT for a malformed record or slug. A record without `realm`, or with
 * `realm.enabled !== true`, imports as a plain team.
 */
export function parseImportedRealm(record: Indexable): ImportedRealm {
  const realm = record.realm;
  if (realm === undefined || realm === null) return { enabled: false };
  if (!isRecord(realm)) invalid('realm must be an object');
  if (realm.enabled !== true) return { enabled: false };
  const slug = assertValidSlug(realm.slug);
  const settings = record.realmSettings ?? {};
  if (!isRecord(settings)) invalid('realmSettings must be an object');
  const { input, allowedHomeRealmSlugs } = sanitizeImportedSettings(settings);
  return { enabled: true, slug, input, allowedHomeRealmSlugs };
}

/**
 * Settings to store for an imported realm. The file is the source of truth, so the
 * result starts from the defaults rather than from the stored settings; secrets are
 * never imported, the ones already stored are kept for providers that remain.
 */
export function buildImportedSettings(params: {
  input: Indexable;
  existingSecrets?: RealmOAuthSecrets | null;
}) {
  const { settings, oauthSecrets } = buildRealmSettingsWrite({
    base: defaultRealmSettings(),
    baseSecrets: params.existingSecrets,
    input: params.input,
  });
  const providers = Object.keys(settings.strategies.oauth ?? {});
  const kept: RealmOAuthSecrets = {};
  for (const [provider, secrets] of Object.entries(oauthSecrets)) {
    if (providers.includes(provider)) {
      kept[provider as keyof RealmOAuthSecrets] = secrets;
    }
  }
  return { settings, oauthSecrets: kept };
}

/** Maps trusted home realm slugs to ids; slugs without a realm come back as `missing`. */
export function resolveAllowedHomeRealms(
  slugs: string[],
  idBySlug: ReadonlyMap<string, string>,
): { ids: string[]; missing: string[] } {
  const ids: string[] = [];
  const missing: string[] = [];
  for (const slug of slugs) {
    const id = idBySlug.get(slug);
    if (id) ids.push(id);
    else missing.push(slug);
  }
  return { ids, missing };
}
