/**
 * Pure helpers of the realm gRPC surface (Team realm fields, SetTeamRealm,
 * RealmResponse). No IO: unit-testable with node --test.
 */
import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isRealmId, RealmMembershipType } from './realm.logic.js';

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The slug of a team, only while it is an enabled realm. */
export function realmSlugOf(team: Indexable | null | undefined): string | undefined {
  const realm = team?.realm;
  if (realm?.enabled === true && typeof realm.slug === 'string' && realm.slug !== '') {
    return realm.slug;
  }
  return undefined;
}

/** gRPC `Team` message of a team document (existing fields plus the realm marker). */
export function toGrpcTeam(team: Indexable) {
  return {
    id: team._id as string,
    name: team.name as string,
    parentTeam: team.parentTeam as string,
    isDefault: team.isDefault as boolean,
    realmEnabled: team.realm?.enabled === true,
    realmSlug: realmSlugOf(team),
  };
}

/** gRPC callback error that keeps the code of a GrpcError (ModuleError included). */
export function toCallbackError(e: unknown): { code: status; message: string } {
  if (e instanceof GrpcError) return { code: e.code, message: e.message };
  return { code: status.INTERNAL, message: (e as Error)?.message ?? String(e) };
}

export function assertTeamId(value: unknown, field: string = 'teamId'): string {
  if (!isRealmId(value)) {
    throw new GrpcError(status.INVALID_ARGUMENT, `${field} must be a valid Team ID!`);
  }
  return String(value);
}

export function assertUserId(value: unknown): string {
  if (!isRealmId(value)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'userId must be a valid User ID!');
  }
  return String(value);
}

export function parseMembershipType(value: unknown): RealmMembershipType {
  if (value === 'home' || value === 'guest') return value;
  throw new GrpcError(status.INVALID_ARGUMENT, "type must be 'home' or 'guest'");
}

const SETTINGS_KEYS = ['active', 'strategies', 'policies', 'registration'] as const;

/**
 * Parses the optional `settingsJson` of SetTeamRealm into the settings part of a write
 * body. Only the settings keys are carried over (`slug`/`force` can only come from the
 * request fields); the admin handler validates the content.
 */
export function parseSettingsJson(json: string | null | undefined): Indexable {
  if (json === undefined || json === null || json.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new GrpcError(status.INVALID_ARGUMENT, 'settingsJson must be valid JSON');
  }
  if (!isRecord(parsed)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'settingsJson must be a JSON object');
  }
  const settings: Indexable = {};
  for (const key of SETTINGS_KEYS) {
    if (parsed[key] !== undefined) settings[key] = parsed[key];
  }
  return settings;
}

/** The `params` of the promote/update admin handlers for a SetTeamRealm request. */
export function buildSetRealmParams(request: {
  teamId: string;
  slug: string;
  settingsJson?: string | null;
  force?: boolean;
}): Indexable {
  const teamId = assertTeamId(request.teamId);
  if (typeof request.slug !== 'string' || request.slug.trim() === '') {
    throw new GrpcError(status.INVALID_ARGUMENT, 'slug is required');
  }
  return {
    ...parseSettingsJson(request.settingsJson),
    teamId,
    slug: request.slug,
    force: request.force === true,
  };
}

const SECRET_KEYS = new Set(['oauthSecrets', 'clientSecret', 'privateKey']);

/** Deep copy without any secret key (defence in depth for what leaves over gRPC). */
export function stripRealmSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(entry => stripRealmSecrets(entry)) as T;
  if (!isRecord(value)) return value;
  const out: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) continue;
    out[key] = stripRealmSecrets(entry);
  }
  return out as T;
}

/** gRPC `RealmResponse` of the admin `Realm` DTO (settings already masked). */
export function toRealmResponse(dto: {
  team: Indexable;
  settings: Indexable;
  counts: { home: number; guest: number };
}) {
  return {
    team: toGrpcTeam(dto.team),
    settingsJson: JSON.stringify(stripRealmSecrets(dto.settings)),
    homeCount: dto.counts?.home ?? 0,
    guestCount: dto.counts?.guest ?? 0,
  };
}
