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
import { RealmMembership, Token, User } from '../models/index.js';
import {
  assertValidSlug,
  deleteUserRealmMemberships,
  grantRealmMembership,
  RealmContext,
  realmsEnabled,
  resolveRealm,
  resolveRealmById,
  resolveTeamRealm,
} from '../utils/realm.js';
import {
  decideGuestPrincipalPaged,
  decideGuestSignIn,
  isGlobalStrategyEnabled,
  isHomeRealm,
  isStrategyEnabled,
  passwordVerificationRequired,
  reconcileInvitationRealm,
  scopeUserQuery,
} from './realmRequest.logic.js';

import { anonymousRealmDenial } from './realmRequest.logic.js';

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

/** The account an identifier signs in as, and how: its home account or a linked guest. */
export type ResolvedPrincipal<U = User> = { user: U; via: 'home' | 'guest' };

/**
 * Resolves the account an identifier (`identifierQuery`, e.g. `{ email }`) signs in as at
 * the realm (null = global):
 *  1. the home account of the realm (scopedUserQuery), as before;
 *  2. failing that, with a realm whose `guests.directSignIn` is on, the one linked guest of
 *     the realm holding the identifier (`via: 'guest'`). Two or more are an invariant breach:
 *     logged and refused (null), never resolved to one of them. Every holder is considered
 *     (paged, see decideGuestPrincipalPaged), so the answer does not depend on how many
 *     realms share the identifier.
 * Works in both identity modes. `options.select` is passed to the lookups (for example
 * `+hashedPassword`). The guest lookup reads the holders without it and loads only the chosen
 * account in full.
 */
export async function resolvePrincipal(
  realmCtx: RealmContext | null | undefined,
  identifierQuery: Indexable,
  options: { select?: string } = {},
): Promise<ResolvedPrincipal | null> {
  const home = await User.getInstance().findOne(
    scopedUserQuery(identifierQuery, realmCtx),
    options,
  );
  if (home) return { user: home, via: 'home' };
  if (!realmCtx || !realmCtx.effective.policies.guests.directSignIn) return null;

  const realmId = realmIdOf(realmCtx)!;
  const decision = await decideGuestPrincipalPaged({
    realmId,
    directSignIn: true,
    readHolders: (skip, limit) =>
      User.getInstance().findMany(identifierQuery, {
        select: '_id homeRealm',
        sort: { _id: 1 },
        skip,
        limit,
      }),
    guestIdsAmong: async userIds => {
      const guestOf = await RealmMembership.getInstance().findMany(
        { realm: realmId, membershipType: 'guest', user: { $in: userIds } },
        { select: 'user' },
      );
      return guestOf.map(membership => String(membership.user));
    },
  });
  if (decision.outcome === 'many') {
    ConduitGrpcSdk.Logger.warn(
      `Realm ${realmId} holds more than one guest for one identifier; sign-in refused`,
    );
  }
  if (decision.outcome !== 'one') return null;
  const guest = await User.getInstance().findOne(
    { _id: String(decision.user._id) },
    options,
  );
  return guest ? { user: guest, via: 'guest' } : null;
}

/** A user admitted to sign in at a realm (see admitPrincipal). */
export type SignInPrincipal<U = User> = {
  user: U;
  via: 'home' | 'guest';
  /** A guest's home realm context (null for a global home). Unused for home accounts. */
  homeCtx: RealmContext | null;
};

/**
 * The guest gate of a user of realm R (see decideGuestSignIn). A home realm that is missing
 * or inactive does not raise: it leaves the gate closed. `homeCtx` is the admitted home
 * realm context, for the stricter verification rule of password logins.
 */
export async function guestSignInGate(
  realmCtx: RealmContext,
  user: Pick<User, 'homeRealm'>,
  strategyKey: string,
): Promise<{ ok: true; homeCtx: RealmContext | null } | { ok: false }> {
  let homeCtx: RealmContext | null = null;
  let homeStrategyEnabled: boolean | null;
  if (user.homeRealm) {
    try {
      homeCtx = await resolveRealmById(String(user.homeRealm));
    } catch (err) {
      if (!hasConduitCode(err, errors.REALM_NOT_FOUND)) throw err;
      homeCtx = null;
    }
    homeStrategyEnabled = homeCtx
      ? isStrategyEnabled(homeCtx.effective, strategyKey)
      : null;
  } else {
    homeStrategyEnabled = isGlobalStrategyEnabled(
      ConfigController.getInstance().config,
      strategyKey,
    );
  }
  const gate = decideGuestSignIn({
    directSignIn: realmCtx.effective.policies.guests.directSignIn,
    strategyAtRealm: isStrategyEnabled(realmCtx.effective, strategyKey),
    homeStrategyEnabled,
  });
  return gate.ok ? { ok: true, homeCtx } : { ok: false };
}

/**
 * Admits a user that a login flow found (or that a token points to) at the realm. The realm's
 * strategy is checked first and throws, the same for every identifier. A home account is then
 * admitted. A guest must pass the guest gate. `null` means "not found": a refused guest is
 * answered exactly like an unknown identifier by the caller.
 */
export async function admitPrincipal<U extends Pick<User, 'homeRealm'>>(
  realmCtx: RealmContext | null | undefined,
  user: U | null | undefined,
  strategyKey: string,
): Promise<SignInPrincipal<U> | null> {
  assertStrategyEnabledForRealm(realmCtx, strategyKey);
  if (!user) return null;
  if (!realmCtx || isHomeRealm(user.homeRealm, realmIdOf(realmCtx))) {
    return { user, via: 'home', homeCtx: null };
  }
  const gate = await guestSignInGate(realmCtx, user, strategyKey);
  return gate.ok ? { user, via: 'guest', homeCtx: gate.homeCtx } : null;
}

/**
 * Resolves the principal of a login or credential flow for an identifier and applies the
 * strategy rules (see admitPrincipal). `null` is "not found" for every reason, so the caller
 * gives its usual not-found answer.
 */
export async function resolveSignInPrincipal(
  realmCtx: RealmContext | null | undefined,
  identifierQuery: Indexable,
  strategyKey: string,
  options: { select?: string } = {},
): Promise<SignInPrincipal | null> {
  // answered before any lookup, so the realm-level answer never depends on the identifier
  assertStrategyEnabledForRealm(realmCtx, strategyKey);
  const resolved = await resolvePrincipal(realmCtx, identifierQuery, options);
  return admitPrincipal(realmCtx, resolved?.user ?? null, strategyKey);
}

/**
 * The `verificationRequired` override of a password check for a resolved principal (see
 * passwordVerificationRequired). Undefined without a realm: the global config applies.
 */
export function loginVerificationOverride(
  realmCtx: RealmContext | null | undefined,
  principal: SignInPrincipal,
  globalVerificationRequired: boolean,
): { verificationRequired: boolean } | undefined {
  if (!realmCtx) return undefined;
  const homeRequired = principal.homeCtx
    ? principal.homeCtx.effective.strategies.local.verificationRequired
    : globalVerificationRequired;
  return {
    verificationRequired: passwordVerificationRequired({
      via: principal.via,
      realmRequired: realmCtx.effective.strategies.local.verificationRequired,
      homeRequired,
    }),
  };
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
 * Throws the realm access error a new anonymous user would get at token issuance
 * (REALM_ACCESS_DENIED, TWO_FA_REQUIRED_FOR_REALM), before the user is created.
 */
export function assertAnonymousRealmAllowed(
  ctx: RealmContext | null | undefined,
  clientId: string,
): void {
  if (!ctx) return;
  const denial = anonymousRealmDenial(
    String(ctx.team._id),
    ctx.effective.policies,
    clientId,
  );
  if (denial) throw new ModuleError(errors[denial]);
}

/**
 * Best-effort cleanup of a user created by a registration that then failed: its realm
 * membership, its authorization relations (realm team, default team) and the user
 * itself. Never throws, so it cannot mask the error that triggered it.
 */
export async function rollbackRegisteredUser(
  grpcSdk: ConduitGrpcSdk,
  user: Pick<User, '_id'>,
): Promise<void> {
  const userId = String(user._id);
  const steps: (() => Promise<unknown>)[] = [
    () => deleteUserRealmMemberships(userId),
    async () => {
      try {
        await grpcSdk.authorization!.deleteAllRelations({ subject: 'User:' + userId });
      } catch {
        // authorization is not available (teams off) or the user has no relations
      }
    },
    () => User.getInstance().deleteOne({ _id: userId }),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
    }
  }
}

/**
 * Runs a step of a registration that happens after the user was created (home
 * membership, token issuance). When it fails the user is rolled back and the error is
 * rethrown, like the admin `createUser` does: a realm user is never left without its
 * membership, and a failed registration leaves no orphan behind.
 */
export async function rollbackUserOnFailure<T>(
  grpcSdk: ConduitGrpcSdk,
  user: Pick<User, '_id'>,
  step: () => Promise<T>,
): Promise<T> {
  try {
    return await step();
  } catch (err) {
    await rollbackRegisteredUser(grpcSdk, user);
    throw err;
  }
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
