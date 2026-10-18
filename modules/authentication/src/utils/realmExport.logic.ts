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
 * is exported as `allowedHomeRealmSlugs`. An id that is not an enabled realm cannot be
 * named by slug; it is exported as `unresolved:<id>` (the export format has no warnings
 * channel) so the import fails closed instead of silently widening the list: see
 * `decideTrustedHomeRealms`.
 *
 * Import semantics (the file is the source of truth for the realms it lists):
 *  - a realm team without `realmSettings` is written with the defaults, whatever it had;
 *  - while the realms feature is off the realm part of every record is skipped and
 *    reported (nothing is promoted, re-homed or revoked), like the admin routes;
 *  - `realm.enabled: false` (or no `realm`) leaves a realm that exists in the database
 *    alone: demoting is destructive and stays an explicit admin action;
 *  - secrets are never imported; the ones stored for providers that remain are kept.
 */
import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isRecord } from './common.logic.js';
import { buildRealmSettingsWrite, pickSettingsFields } from '../admin/realm.logic.js';
import type { ImportResultEntry } from '@conduitplatform/module-tools';
import {
  assertValidSlug,
  defaultRealmSettings,
  maskRealmSettings,
  normalizeIdList,
  RealmOAuthSecrets,
} from './realm.logic.js';

/** Marks a trusted home realm id the exporting environment could not name by slug. */
export const UNRESOLVED_REALM_PREFIX = 'unresolved:';

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
  const slugs = (allowedHomeRealms as string[]).map(
    id => slugById.get(String(id)) ?? `${UNRESOLVED_REALM_PREFIX}${id}`,
  );
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
      /**
       * slugs of the trusted home realms (undefined = the file does not say), resolved
       * against the database and the file's own realms before anything is written
       */
      allowedHomeRealmSlugs: string[] | undefined;
      /** `unresolved:<id>` entries of the file: they can never resolve */
      unresolvedHomeRealms: string[];
    };

/** Whitelists the settings keys and drops every secret and read-only flag. */
function sanitizeImportedSettings(settings: Indexable): {
  input: Indexable;
  allowedHomeRealmSlugs: string[] | undefined;
  unresolvedHomeRealms: string[];
} {
  const input: Indexable = {};
  let allowedHomeRealmSlugs: string[] | undefined;
  const unresolvedHomeRealms: string[] = [];
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
        const named: unknown[] = [];
        for (const entry of slugs) {
          if (typeof entry === 'string' && entry.startsWith(UNRESOLVED_REALM_PREFIX)) {
            unresolvedHomeRealms.push(entry);
          } else {
            named.push(entry);
          }
        }
        allowedHomeRealmSlugs = Array.from(
          new Set(named.map(slug => assertValidSlug(slug))),
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
  return { input, allowedHomeRealmSlugs, unresolvedHomeRealms };
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
  const { input, allowedHomeRealmSlugs, unresolvedHomeRealms } =
    sanitizeImportedSettings(settings);
  return { enabled: true, slug, input, allowedHomeRealmSlugs, unresolvedHomeRealms };
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
    // secrets are never imported: a provider with its own clientId arrives before its
    // secret does and fails closed at request time until the secret is set
    allowIncompleteCredentials: true,
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

// ---------------------------------------------------------------------------
// Trusted home realms (fail closed)
// ---------------------------------------------------------------------------

export type TrustedHomeRealmsDecision = {
  /** the list to store in `policies.guests.allowedHomeRealms` */
  allowedHomeRealms: string[];
  /** the realm does not exist yet and the list could not be resolved: no guests */
  disallowGuests: boolean;
  /** slugs / markers that did not resolve (empty = everything resolved) */
  missing: string[];
};

/**
 * Decides what to store for `policies.guests.allowedHomeRealms` BEFORE anything is
 * written. An empty list means "any home realm", so an unresolved entry must never be
 * dropped from it:
 *  - everything resolved: the resolved ids;
 *  - something unresolved and the realm already exists (`storedIds` given): keep the
 *    stored list untouched;
 *  - something unresolved and the realm is new (`storedIds` null): write
 *    `guests.allowed = false` (the resolved ids are kept for when guests are enabled).
 * `slugs` undefined (the file does not say) returns null: the imported settings stand.
 */
export function decideTrustedHomeRealms(params: {
  slugs: string[] | undefined;
  unresolved?: string[];
  idBySlug: ReadonlyMap<string, string>;
  storedIds: string[] | null;
}): TrustedHomeRealmsDecision | null {
  if (params.slugs === undefined) return null;
  const { ids, missing } = resolveAllowedHomeRealms(params.slugs, params.idBySlug);
  const unresolved = params.unresolved ?? [];
  if (missing.length === 0 && unresolved.length === 0) {
    return { allowedHomeRealms: ids, disallowGuests: false, missing: [] };
  }
  const allMissing = [...missing, ...unresolved];
  if (params.storedIds) {
    return {
      allowedHomeRealms: normalizeIdList(params.storedIds),
      disallowGuests: false,
      missing: allMissing,
    };
  }
  return { allowedHomeRealms: ids, disallowGuests: true, missing: allMissing };
}

/** Applies a trusted home realms decision to the settings about to be stored. */
export function applyTrustedHomeRealms<
  T extends { policies: { guests: { allowed: boolean; allowedHomeRealms: string[] } } },
>(settings: T, decision: TrustedHomeRealmsDecision | null): T {
  if (!decision) return settings;
  return {
    ...settings,
    policies: {
      ...settings.policies,
      guests: {
        ...settings.policies.guests,
        allowed: decision.disallowGuests ? false : settings.policies.guests.allowed,
        allowedHomeRealms: decision.allowedHomeRealms,
      },
    },
  };
}

/** Realms are top-level: the query for a team by name on the top level. */
export function topLevelTeamQuery(name: string): Indexable {
  return {
    name,
    $or: [{ parentTeam: null }, { parentTeam: { $exists: false } }],
  };
}

// ---------------------------------------------------------------------------
// Result counting
// ---------------------------------------------------------------------------

type ImportOutcome = 'created' | 'updated' | 'failed';

/**
 * Message of a realm part that is skipped because the realms feature is off, mirroring
 * the admin routes' REALMS_DISABLED.
 */
export function realmsDisabledSkipMessage(name: string): string {
  return `${name}: realm: skipped, realms are disabled (REALMS_DISABLED: enable teams and teams.realms in the authentication config and import again)`;
}

/**
 * Counts every record of an import once. A record that was counted as created or
 * updated and then fails in a later step (parent assignment, realm) is moved to
 * `failed`, never counted twice; its error is recorded.
 */
export class ImportTally {
  private readonly outcomes = new Map<number, ImportOutcome>();

  constructor(private readonly result: ImportResultEntry) {}

  outcome(index: number): ImportOutcome | undefined {
    return this.outcomes.get(index);
  }

  created(index: number): void {
    this.set(index, 'created');
  }

  updated(index: number): void {
    this.set(index, 'updated');
  }

  /**
   * Reports a part of a record that was deliberately not applied (the record itself keeps
   * its outcome and counts as before). The line goes to `errors` so it is visible.
   */
  skipped(message: string): void {
    this.result.errors.push(message);
  }

  /** Records the error; the record counts as failed exactly once. */
  failed(index: number, message: string): void {
    this.set(index, 'failed');
    this.result.errors.push(message);
  }

  private set(index: number, next: ImportOutcome): void {
    const previous = this.outcomes.get(index);
    if (previous === next) return;
    if (previous) this.result[previous] -= 1;
    this.outcomes.set(index, next);
    this.result[next] += 1;
  }
}
