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
  BoundedTtlCache,
  buildEffectiveSettings,
  collectTeamChain,
  computeIdentityMode,
  computeRealmsEnabled,
  createIdentifierCollisionCounter,
  EffectiveAuthSettings,
  evaluateRealmAccess,
  hasNestedRealmViolation,
  IdentifierCollisionCounts,
  IdentityMode,
  mergeOAuthSecrets,
  nearestRealmInChain,
  normalizeSlug,
  REALM_OAUTH_PROVIDERS,
  RealmMembershipType,
  StoredRealmSettingsData,
  unresolvedRealmError,
  uniquenessQuery,
} from './realm.logic.js';
import { invalidateOAuthSettingsCache } from '../handlers/oauth2/utils/oauthSettings.logic.js';

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
  return computeRealmsEnabled(ConfigController.getInstance().config?.teams);
}

// ---------------------------------------------------------------------------
// Identity mode
// ---------------------------------------------------------------------------

/** The applied identity mode. Always `shared` while realms are off. */
export function identityMode(): IdentityMode {
  return computeIdentityMode(ConfigController.getInstance().config?.teams);
}

/**
 * Scopes a global identifier check (email, phone, username, wallet, OAuth id) to the
 * identity mode: `realmId` is the realm of the request or of the target user, `null` for
 * global. Shared mode returns `identifierQuery` untouched and makes no extra call.
 */
export function uniqueIdentifierQuery(
  identifierQuery: Indexable,
  realmId: string | null | undefined,
): Indexable {
  return uniquenessQuery(identifierQuery, realmId, identityMode());
}

/**
 * Refuses an identifier (`identifierQuery`, e.g. `{ email }`) that another account already
 * holds in the scope of the user: its home realm in isolated mode, every account in shared
 * mode. Phase 2 extends the scope to the realms the user is linked into; callers do not
 * change when it does.
 */
export async function assertIdentifierFreeForUser(
  user: { homeRealm?: unknown },
  identifierQuery: Indexable,
  takenMessage: string,
): Promise<void> {
  const homeRealm = user.homeRealm ? String(user.homeRealm) : null;
  const holder = await User.getInstance().findOne(
    uniqueIdentifierQuery(identifierQuery, homeRealm),
  );
  if (holder) throw new GrpcError(status.ALREADY_EXISTS, takenMessage);
}

const IDENTIFIER_SCAN_PAGE_SIZE = 500;
// top-level fields only: nested paths are not portable across the database adapters
const IDENTIFIER_SCAN_SELECT = [
  '_id',
  'homeRealm',
  'email',
  'phoneNumber',
  'username',
  'metamask',
  ...REALM_OAUTH_PROVIDERS,
].join(' ');

/**
 * Counts the identifier values held by more than one user, over every account (global and
 * realm). Used by the switch to shared mode, which is refused while this is not zero. Pages
 * through `User` in id order with a keyset cursor (`_id > last`), so a page does not shift
 * when users are written during the scan, and reads from the primary.
 */
export async function countIdentifierCollisions(): Promise<IdentifierCollisionCounts> {
  const counter = createIdentifierCollisionCounter();
  let lastId: string | undefined;
  for (;;) {
    const page = await User.getInstance().findMany(
      lastId === undefined ? {} : { _id: { $gt: lastId } },
      {
        select: IDENTIFIER_SCAN_SELECT,
        limit: IDENTIFIER_SCAN_PAGE_SIZE,
        sort: { _id: 1 },
        readPreference: 'primary',
      },
    );
    counter.add(page);
    if (page.length < IDENTIFIER_SCAN_PAGE_SIZE) break;
    lastId = page[page.length - 1]._id;
  }
  return counter.result();
}

function cacheTtlMs(): number {
  const ttl = ConfigController.getInstance().config?.teams?.realms?.cacheTtlMs;
  return typeof ttl === 'number' && ttl > 0 ? ttl : 0;
}

const MAX_CACHE_ENTRIES = 500;

// The caches hand out clones (see BoundedTtlCache), so callers may mutate what they get.
const contextBySlug = new BoundedTtlCache<RealmContext>(MAX_CACHE_ENTRIES);
const contextById = new BoundedTtlCache<RealmContext>(MAX_CACHE_ENTRIES);
const slugById = new BoundedTtlCache<string | null>(MAX_CACHE_ENTRIES);
// Bumped by every invalidation so that a load that started before it cannot repopulate
// the cache with data read before the write.
let cacheGeneration = 0;

/**
 * Drops every cached realm (contexts and id -> slug lookups).
 *
 * IMPORTANT: every code path that writes a realm (Team.realm, RealmSettings, promote,
 * demote, delete, slug change, activation) MUST call this after the write, and the realm
 * bus event handler must call it on the other replicas. Otherwise stale settings are
 * served for up to `teams.realms.cacheTtlMs`.
 */
export function invalidateRealmCache(): void {
  cacheGeneration++;
  contextBySlug.clear();
  contextById.clear();
  slugById.clear();
  // per-realm OAuth settings are built from the cached contexts
  invalidateOAuthSettingsCache();
}

// ---------------------------------------------------------------------------
// Realm resolution
// ---------------------------------------------------------------------------

async function loadContext(teamQuery: Indexable): Promise<RealmContext | null> {
  const generation = cacheGeneration;
  const query: Indexable = { ...teamQuery, 'realm.enabled': true };
  const team = await Team.getInstance().findOne(query);
  if (!team) return null;
  // oauthSecrets is `select: false` (like hashedPassword): ask for it explicitly
  const settings = await RealmSettings.getInstance().findOne(
    { team: team._id, active: true },
    { select: '+oauthSecrets' },
  );
  if (!settings) return null;
  const { oauthSecrets, ...storedSettings } = settings;
  const context: RealmContext = {
    team,
    // the cached/returned settings never carry the secrets, only `effective` does
    settings: storedSettings as RealmSettings,
    effective: buildEffectiveSettings(
      ConfigController.getInstance().config,
      mergeOAuthSecrets(storedSettings as StoredRealmSettingsData, oauthSecrets),
    ),
  };
  if (generation === cacheGeneration) {
    const ttl = cacheTtlMs();
    if (team.realm?.slug) contextBySlug.set(team.realm.slug, context, ttl);
    contextById.set(String(team._id), context, ttl);
  }
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
    contextBySlug.get(normalized) ?? (await loadContext({ 'realm.slug': normalized }));
  if (!context) throw new ModuleError(errors.REALM_NOT_FOUND);
  return context;
}

async function findRealmContextById(realmId: string): Promise<RealmContext | null> {
  const id = String(realmId);
  return contextById.get(id) ?? (await loadContext({ _id: id }));
}

/** Same as resolveRealm, by realm team id. Throws REALM_NOT_FOUND. */
export async function resolveRealmById(realmId: string): Promise<RealmContext> {
  const context = await findRealmContextById(realmId);
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
  const cached = slugById.get(id);
  if (cached !== undefined) return cached ?? undefined;
  const generation = cacheGeneration;
  const team = await Team.getInstance().findOne({ _id: id });
  const slug = team?.realm?.enabled ? (team.realm.slug ?? null) : null;
  if (generation === cacheGeneration) slugById.set(id, slug, cacheTtlMs());
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

/**
 * Second half of the slug check, for after the write: `assertSlugAvailable` is a
 * check-then-write, so two concurrent writers can both pass it. Call this once the team
 * carries the slug and roll the write back when it throws REALM_SLUG_TAKEN. When both
 * racers see each other both roll back (the caller can simply retry), but a duplicate
 * slug is never left in place.
 */
export async function assertSlugUniqueAfterWrite(
  slug: string,
  teamId: string,
): Promise<void> {
  // counts the teams carrying the slug other than the one just written: anything beyond
  // the team itself (total > 1) is a collision
  const query: Indexable = {
    'realm.slug': normalizeSlug(slug),
    _id: { $ne: String(teamId) },
  };
  const others = await Team.getInstance().countDocuments(query);
  if (others > 0) throw new ModuleError(errors.REALM_SLUG_TAKEN);
}

// ---------------------------------------------------------------------------
// Team tree
// ---------------------------------------------------------------------------

const fetchTeamById = (id: string) => Team.getInstance().findOne({ _id: id });
const fetchChildTeams = (parentIds: string[]) =>
  Team.getInstance().findMany({ parentTeam: { $in: parentIds } });

/**
 * Nearest realm team of `teamId` (the team itself or an ancestor), or null when the
 * team is not inside a realm.
 */
export async function resolveTeamRealm(teamId: string): Promise<Team | null> {
  return nearestRealmInChain(await collectTeamChain(String(teamId), fetchTeamById));
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
  const violation = await hasNestedRealmViolation({
    team,
    parentTeamId,
    promote: options.promote,
    fetchTeam: fetchTeamById,
    fetchChildren: fetchChildTeams,
  });
  if (violation) throw new ModuleError(errors.REALM_NESTED);
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

/**
 * Removes every realm membership (home and guest) of the given user(s). Called when
 * users are deleted, so no membership row outlives its user. DB only: relations and
 * tokens are the caller's business.
 */
export async function deleteUserRealmMemberships(
  userIds: string | string[],
): Promise<void> {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).map(String);
  if (ids.length === 0) return;
  await RealmMembership.getInstance().deleteMany(
    ids.length === 1 ? { user: ids[0] } : { user: { $in: ids } },
  );
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
    const context = await findRealmContextById(requestedRealm);
    if (!context) {
      throw new ModuleError(errors[unresolvedRealmError(requestedRealm, userHomeRealm)]);
    }
    policies = context.effective.policies;
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
