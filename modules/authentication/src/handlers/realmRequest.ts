import {
  ConduitGrpcSdk,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  ConfigController,
  ConduitString,
  ModuleError,
} from '@conduitplatform/module-tools';
import { TokenType } from '../constants/index.js';
import { errors } from '../errors.js';
import { hasConduitCode } from '../utils/common.logic.js';
import { Token, User } from '../models/index.js';
import {
  assertValidSlug,
  grantRealmMembership,
  RealmContext,
  realmsEnabled,
  resolveRealm,
  resolveRealmById,
  resolveTeamRealm,
} from '../utils/realm.js';
import {
  isGlobalStrategyEnabled,
  isHomeRealm,
  isStrategyEnabled,
  reconcileInvitationRealm,
  scopeUserQuery,
} from './realmRequest.logic.js';

export * from './realmRequest.logic.js';

/** Optional `realm` slug route param (body or query) of the login/registration routes. */
export const realmParam = ConduitString.Optional;

/** Realm team id of a context, null for global. */
export function realmIdOf(ctx: RealmContext | null | undefined): string | null {
  return ctx ? String(ctx.team._id) : null;
}

/**
 * Resolves a realm slug (from a request or from an intermediate token's data).
 * No slug means global (null). Throws REALMS_DISABLED / REALM_NOT_FOUND.
 */
export async function resolveRealmFromSlug(slug: unknown): Promise<RealmContext | null> {
  if (slug === undefined || slug === null || slug === '') return null;
  // let the feature flag answer first, whatever the slug looks like
  if (realmsEnabled()) assertValidSlug(slug);
  return resolveRealm(String(slug));
}

/** Reads the optional `realm` param (body or query) of a call. */
export function resolveRealmFromCall(
  call: Pick<ParsedRouterRequest, 'request'>,
): Promise<RealmContext | null> {
  return resolveRealmFromSlug((call.request.params as Indexable | undefined)?.realm);
}

/** Throws STRATEGY_NOT_AVAILABLE_FOR_REALM when a realm is given and lacks the strategy. */
export function assertStrategyEnabledForRealm(
  ctx: RealmContext | null | undefined,
  strategyKey: string,
): void {
  if (!ctx) return;
  if (!isStrategyEnabled(ctx.effective, strategyKey)) {
    throw new ModuleError(errors.STRATEGY_NOT_AVAILABLE_FOR_REALM);
  }
}

/**
 * For a call without a realm: throws NOT_FOUND 'Requested resource not found' when the
 * strategy is disabled in the global config. The route can exist only because a realm
 * enables the strategy, and realm-less calls must not reach it (same answer as the
 * OAuth handlers). Call it right after `resolveRealmFromCall` returned null.
 */
export function assertGlobalStrategyAvailable(strategyKey: string): void {
  if (!isGlobalStrategyEnabled(ConfigController.getInstance().config, strategyKey)) {
    throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
  }
}

/** Home-realm scoped user lookup query (untouched when no realm and realms are off). */
export function scopedUserQuery<T extends Record<string, unknown>>(
  query: T,
  ctx: RealmContext | null | undefined,
): T {
  return scopeUserQuery(query, realmIdOf(ctx), realmsEnabled());
}

/** `{ homeRealm }` to spread into a new user's fields; empty for global users. */
export function homeRealmFields(ctx: RealmContext | null | undefined): {
  homeRealm?: string;
} {
  const realmId = realmIdOf(ctx);
  return realmId ? { homeRealm: realmId } : {};
}

/**
 * Writes the home membership of a newly registered user. `withRole` also creates the
 * `member` relation on the realm team; pass false when an invitation creates the
 * relation itself.
 */
export async function grantHomeMembership(
  grpcSdk: ConduitGrpcSdk,
  user: Pick<User, '_id'>,
  ctx: RealmContext | null | undefined,
  withRole: boolean = true,
): Promise<void> {
  if (!ctx) return;
  await grantRealmMembership(grpcSdk, {
    userId: String(user._id),
    realmTeamId: String(ctx.team._id),
    type: 'home',
    role: withRole ? 'member' : undefined,
  });
}

/**
 * Writes the home membership of a user registering with an optional invitation. The
 * `member` relation on the realm team is skipped only when the invitation is into that
 * realm (it creates the team relation itself); an invitation into a team outside the
 * realm still leaves the user a plain member of the realm team.
 */
export async function grantHomeMembershipForRegistration(
  grpcSdk: ConduitGrpcSdk,
  user: Pick<User, '_id'>,
  ctx: RealmContext | null | undefined,
  invitationToken?: string | null,
): Promise<void> {
  if (!ctx) return;
  let withRole = true;
  if (invitationToken) {
    const inviteToken = await Token.getInstance().findOne(
      { tokenType: TokenType.TEAM_INVITE_TOKEN, token: invitationToken },
      { readPreference: 'primary' },
    );
    const inviteRealm = inviteToken?.data?.teamId
      ? await resolveTeamRealm(String(inviteToken.data.teamId))
      : null;
    withRole = !inviteRealm || String(inviteRealm._id) !== realmIdOf(ctx);
  }
  await grantHomeMembership(grpcSdk, user, ctx, withRole);
}

/**
 * Reconciles the requested realm with the realm of an invitation token (see
 * reconcileInvitationRealm). Without realms or without a token this is a no-op.
 */
export async function resolveInvitationRealm(
  ctx: RealmContext | null,
  invitationToken: string | undefined | null,
  options: { allowImplied?: boolean } = {},
): Promise<RealmContext | null> {
  if (!invitationToken || !realmsEnabled()) return ctx;
  const inviteToken = await Token.getInstance().findOne(
    { tokenType: TokenType.TEAM_INVITE_TOKEN, token: invitationToken },
    { readPreference: 'primary' },
  );
  // an unknown token is rejected by the invitation validation of the caller
  if (!inviteToken) return ctx;
  const inviteRealm = inviteToken.data?.teamId
    ? await resolveTeamRealm(String(inviteToken.data.teamId))
    : null;
  const realmId = reconcileInvitationRealm(
    realmIdOf(ctx),
    inviteRealm ? String(inviteRealm._id) : null,
    options.allowImplied === true,
  );
  if (!realmId || realmId === realmIdOf(ctx)) return ctx;
  return resolveRealmById(realmId);
}

/**
 * Realm context of a user's home realm (null for global users or with realms off).
 * An inactive or missing home realm is REALM_ACCESS_DENIED, like at token issuance.
 */
export async function resolveHomeRealmContext(
  user: Pick<User, 'homeRealm'>,
): Promise<RealmContext | null> {
  if (!user.homeRealm || !realmsEnabled()) return null;
  try {
    return await resolveRealmById(String(user.homeRealm));
  } catch (err) {
    if (hasConduitCode(err, errors.REALM_NOT_FOUND)) {
      throw new ModuleError(errors.REALM_ACCESS_DENIED);
    }
    throw err;
  }
}

/** Throws REALM_ACCESS_DENIED when an anonymous user is converted in another realm. */
export function assertAnonymousUserInRealm(
  anonymousUser: Pick<User, 'homeRealm'>,
  ctx: RealmContext | null | undefined,
): void {
  if (!isHomeRealm(anonymousUser.homeRealm, realmIdOf(ctx))) {
    throw new ModuleError(errors.REALM_ACCESS_DENIED);
  }
}

/** Realm team id of the session behind an authenticated call (null for global). */
export function sessionRealmId(context: Indexable | undefined): string | null {
  return context?.realm ? String(context.realm) : null;
}
