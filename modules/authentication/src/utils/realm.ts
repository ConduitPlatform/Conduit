import { ConduitGrpcSdk, GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { ConfigController, ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
import {
  AccessToken,
  RealmMembership,
  RealmSettings,
  RefreshToken,
  Team,
  User,
} from '../models/index.js';
import {
  assertGuestAllowed,
  buildEffectiveSettings,
  EffectiveAuthSettings,
  evaluateRealmAccess,
  nearestRealmInChain,
  normalizeSlug,
  RealmMembershipType,
  RealmSettingsData,
} from './realm.logic.js';

export * from './realm.logic.js';

export type RealmContext = {
  team: Team;
  settings: RealmSettings;
  effective: EffectiveAuthSettings;
};

// ---------------------------------------------------------------------------
// Feature flag and cache
// ---------------------------------------------------------------------------

export function realmsEnabled(): boolean {
  return ConfigController.getInstance().config?.teams?.realms?.enabled === true;
}

function cacheTtlMs(): number {
  const ttl = ConfigController.getInstance().config?.teams?.realms?.cacheTtlMs;
  return typeof ttl === 'number' && ttl > 0 ? ttl : 0;
}

type CacheEntry<T> = { value: T; expires: number };

const contextBySlug = new Map<string, CacheEntry<RealmContext>>();
const contextById = new Map<string, CacheEntry<RealmContext>>();
const slugById = new Map<string, CacheEntry<string | null>>();

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  const ttl = cacheTtlMs();
  if (ttl === 0) return;
  cache.set(key, { value, expires: Date.now() + ttl });
}

/** Drops every cached realm (call after realm writes and on the realm bus event). */
export function invalidateRealmCache(): void {
  contextBySlug.clear();
  contextById.clear();
  slugById.clear();
}

// ---------------------------------------------------------------------------
// Realm resolution
// ---------------------------------------------------------------------------

async function loadContext(teamQuery: Indexable): Promise<RealmContext | null> {
  const query: Indexable = { ...teamQuery, 'realm.enabled': true };
  const team = await Team.getInstance().findOne(query);
  if (!team) return null;
  const settings = await RealmSettings.getInstance().findOne({
    team: team._id,
    active: true,
  });
  if (!settings) return null;
  const context: RealmContext = {
    team,
    settings,
    effective: buildEffectiveSettings(
      ConfigController.getInstance().config,
      settings as RealmSettingsData,
    ),
  };
  if (team.realm?.slug) writeCache(contextBySlug, team.realm.slug, context);
  writeCache(contextById, String(team._id), context);
  return context;
}

/**
 * Resolves a realm by slug. No slug means global (null).
 * Throws REALMS_DISABLED when a slug is given while the feature is off, and
 * REALM_NOT_FOUND when the slug is unknown or the realm is inactive.
 */
export async function resolveRealm(slug?: string | null): Promise<RealmContext | null> {
  if (slug === undefined || slug === null || slug === '') return null;
  if (!realmsEnabled()) throw new ModuleError(errors.REALMS_DISABLED);
  const normalized = normalizeSlug(String(slug));
  const context =
    readCache(contextBySlug, normalized) ??
    (await loadContext({ 'realm.slug': normalized }));
  if (!context) throw new ModuleError(errors.REALM_NOT_FOUND);
  return context;
}

/** Same as resolveRealm, by realm team id. Throws REALM_NOT_FOUND. */
export async function resolveRealmById(realmId: string): Promise<RealmContext> {
  const id = String(realmId);
  const context = readCache(contextById, id) ?? (await loadContext({ _id: id }));
  if (!context) throw new ModuleError(errors.REALM_NOT_FOUND);
  return context;
}

/**
 * Cheap id -> slug lookup for token payloads. Returns undefined for unknown realms
 * instead of throwing.
 */
export async function getRealmSlugById(
  realmId: string | null | undefined,
): Promise<string | undefined> {
  if (!realmId) return undefined;
  const id = String(realmId);
  const cached = readCache(slugById, id);
  if (cached !== undefined) return cached ?? undefined;
  const team = await Team.getInstance().findOne({ _id: id });
  const slug = team?.realm?.enabled ? (team.realm.slug ?? null) : null;
  writeCache(slugById, id, slug);
  return slug ?? undefined;
}

/**
 * Slugs are not protected by a database unique index (see Team.schema.ts), so every
 * writer must call this first. A slug stays taken as long as any team carries it,
 * enabled or not.
 */
export async function assertSlugAvailable(
  slug: string,
  excludeTeamId?: string,
): Promise<void> {
  const query: Indexable = { 'realm.slug': normalizeSlug(slug) };
  if (excludeTeamId) query['_id'] = { $ne: excludeTeamId };
  const existing = await Team.getInstance().findOne(query);
  if (existing) throw new ModuleError(errors.REALM_SLUG_TAKEN);
}

// ---------------------------------------------------------------------------
// Team tree
// ---------------------------------------------------------------------------

const MAX_TEAM_DEPTH = 64;

/**
 * Nearest realm team of `teamId` (the team itself or an ancestor), or null when the
 * team is not inside a realm.
 */
export async function resolveTeamRealm(teamId: string): Promise<Team | null> {
  const chain: Team[] = [];
  const seen = new Set<string>();
  let currentId: string | null | undefined = String(teamId);
  while (currentId && !seen.has(currentId) && chain.length < MAX_TEAM_DEPTH) {
    seen.add(currentId);
    const team: Team | null = await Team.getInstance().findOne({ _id: currentId });
    if (!team) break;
    chain.push(team);
    if (team.realm?.enabled) break;
    currentId = team.parentTeam ? String(team.parentTeam) : null;
  }
  return nearestRealmInChain(chain);
}

async function subtreeHasRealm(teamId: string): Promise<boolean> {
  let level = [String(teamId)];
  const seen = new Set(level);
  for (let depth = 0; level.length > 0 && depth < MAX_TEAM_DEPTH; depth++) {
    const children = await Team.getInstance().findMany({ parentTeam: { $in: level } });
    if (children.some(child => child.realm?.enabled)) return true;
    level = children.map(child => String(child._id)).filter(id => !seen.has(id));
    level.forEach(id => seen.add(id));
  }
  return false;
}

/**
 * Throws REALM_NESTED when the team tree would contain a nested realm.
 *  - `parentTeamId` omitted: validates the team where it currently sits;
 *  - `parentTeamId` given (null = top level): validates re-parenting to it;
 *  - `promote`: validates making the team a realm.
 * A realm must be top-level, no ancestor may be a realm and no descendant may be one.
 */
export async function assertNoNestedRealm(
  teamId: string,
  parentTeamId?: string | null,
  options: { promote?: boolean } = {},
): Promise<void> {
  const team = await Team.getInstance().findOne({ _id: teamId });
  if (!team) throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
  const parent = parentTeamId === undefined ? team.parentTeam : parentTeamId;
  const isRealm = team.realm?.enabled === true || options.promote === true;
  if (isRealm && parent) throw new ModuleError(errors.REALM_NESTED);
  if (parent) {
    const ancestorRealm = await resolveTeamRealm(String(parent));
    if (ancestorRealm && (isRealm || (await subtreeHasRealm(teamId)))) {
      throw new ModuleError(errors.REALM_NESTED);
    }
  }
  if (options.promote && (await subtreeHasRealm(teamId))) {
    throw new ModuleError(errors.REALM_NESTED);
  }
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

/**
 * Writes the RealmMembership document (idempotent: an existing membership is returned
 * untouched, its type is never changed here) and, only when `role` is given, the
 * authorization relation User:<id> -> Team:<realmTeamId>. Callers that already created
 * the relation on a sub-team pass no role.
 * Guest memberships are checked against the realm guest policy (skipped when the realm
 * has no active settings yet, or with `enforceGuestPolicy: false`).
 */
export async function grantRealmMembership(
  grpcSdk: ConduitGrpcSdk,
  params: {
    userId: string;
    realmTeamId: string;
    type: RealmMembershipType;
    role?: string;
    enforceGuestPolicy?: boolean;
  },
): Promise<RealmMembership> {
  const { userId, realmTeamId, type, role } = params;
  let membership = await RealmMembership.getInstance().findOne({
    user: userId,
    realm: realmTeamId,
  });
  if (!membership) {
    if (type === 'guest' && params.enforceGuestPolicy !== false) {
      const settings = await RealmSettings.getInstance().findOne({ team: realmTeamId });
      if (settings) {
        const user = await User.getInstance().findOne({ _id: userId });
        if (!user) throw new GrpcError(status.NOT_FOUND, 'User does not exist');
        assertGuestAllowed(
          settings.policies,
          user.homeRealm ? String(user.homeRealm) : null,
        );
      }
    }
    try {
      membership = await RealmMembership.getInstance().create({
        user: userId,
        realm: realmTeamId,
        membershipType: type,
      });
    } catch (e) {
      // lost a race against the unique (user, realm) index
      membership = await RealmMembership.getInstance().findOne({
        user: userId,
        realm: realmTeamId,
      });
      if (!membership) throw e;
    }
  }
  if (role) {
    await grpcSdk.authorization!.createRelation({
      subject: 'User:' + userId,
      relation: role,
      resource: 'Team:' + realmTeamId,
    });
  }
  return membership;
}

/**
 * Deletes the membership and the user's tokens bound to that realm.
 * Home memberships are refused with HOME_USER_REMOVAL unless `allowHome` is set
 * (admin move / forced demote). `removeRelations` also drops the user's direct
 * relations on the realm team (sub-team relations are the caller's business).
 */
export async function revokeRealmMembership(
  grpcSdk: ConduitGrpcSdk,
  params: {
    userId: string;
    realmTeamId: string;
    allowHome?: boolean;
    removeRelations?: boolean;
  },
): Promise<void> {
  const { userId, realmTeamId } = params;
  const membership = await RealmMembership.getInstance().findOne({
    user: userId,
    realm: realmTeamId,
  });
  if (membership?.membershipType === 'home' && !params.allowHome) {
    throw new ModuleError(errors.HOME_USER_REMOVAL);
  }
  await RealmMembership.getInstance().deleteMany({ user: userId, realm: realmTeamId });
  await Promise.all([
    AccessToken.getInstance().deleteMany({ user: userId, realm: realmTeamId }),
    RefreshToken.getInstance().deleteMany({ user: userId, realm: realmTeamId }),
  ]);
  if (params.removeRelations) {
    try {
      await grpcSdk.authorization!.deleteAllRelations({
        subject: 'User:' + userId,
        resource: 'Team:' + realmTeamId,
      });
    } catch {
      // authorization throws when no relation exists
    }
  }
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/**
 * Loads the membership and realm policies and throws the matching ModuleError when the
 * user may not hold a session in `requestedRealm` (null = global).
 */
export async function assertRealmAccess(params: {
  user: Pick<User, '_id' | 'homeRealm' | 'hasTwoFA' | 'isVerified'>;
  requestedRealm: string | null;
  authorized: boolean;
  clientId: string;
}): Promise<void> {
  const { user, clientId, authorized } = params;
  const requestedRealm = params.requestedRealm ? String(params.requestedRealm) : null;
  const userHomeRealm = user.homeRealm ? String(user.homeRealm) : null;

  let policies = null;
  let membershipType: RealmMembershipType | null = null;
  if (requestedRealm) {
    // inactive/unknown realms deny entry, which also kills their sessions on renew
    policies = (await resolveRealmById(requestedRealm)).effective.policies;
    if (requestedRealm !== userHomeRealm) {
      const membership = await RealmMembership.getInstance().findOne({
        user: String(user._id),
        realm: requestedRealm,
      });
      membershipType = membership?.membershipType ?? null;
    }
  }
  const result = evaluateRealmAccess({
    requestedRealm,
    userHomeRealm,
    membershipType,
    policies,
    assurance: {
      authorized,
      hasTwoFA: user.hasTwoFA,
      isVerified: user.isVerified,
      clientId,
    },
  });
  if (!result.allowed) throw new ModuleError(errors[result.error]);
}
