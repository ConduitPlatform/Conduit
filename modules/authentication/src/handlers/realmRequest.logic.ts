import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import {
  EffectiveAuthSettings,
  evaluateRealmAccess,
  REALM_OAUTH_PROVIDERS,
  RealmPolicies,
  withHomeScope,
} from '../utils/realm.logic.js';
import { isGlobalOAuthAvailable } from './oauth2/utils/oauthSettings.logic.js';

/*
 * Pure request-level realm rules shared by the login and registration handlers (no
 * database or grpc access). IO lives in ./realmRequest.ts.
 */

/**
 * Whether a strategy is enabled in the effective realm settings. Keys are the
 * strategy names ('local', 'username', 'magicLink', 'phone', 'metamask',
 * 'biometric') or `oauth.<provider>`.
 */
export function isStrategyEnabled(
  effective: Pick<EffectiveAuthSettings, 'strategies'>,
  strategyKey: string,
): boolean {
  const strategies = effective.strategies as unknown as Record<string, any>;
  if (strategyKey.startsWith('oauth.')) {
    return strategies.oauth?.[strategyKey.slice('oauth.'.length)]?.enabled === true;
  }
  return strategies[strategyKey]?.enabled === true;
}

/**
 * Scopes a user identifier lookup to a home realm. With no realm and the feature off
 * the query is returned untouched, so flag-off behaviour does not change.
 */
export function scopeUserQuery<T extends Record<string, unknown>>(
  query: T,
  realmId: string | null | undefined,
  realmsEnabled: boolean,
): T {
  if (!realmId && !realmsEnabled) return query;
  return withHomeScope(query, realmId) as T;
}

/**
 * Whether registering needs an invitation. A realm decides for itself
 * (`registration.allowWithoutInvite` overrides the global teams setting); without a
 * realm the global teams setting applies as before.
 */
export function isInviteRequired(
  realmRegistration: { allowWithoutInvite: boolean } | null | undefined,
  teams: { enabled: boolean; allowRegistrationWithoutInvite: boolean },
): boolean {
  if (realmRegistration) return !realmRegistration.allowWithoutInvite;
  return teams.enabled && !teams.allowRegistrationWithoutInvite;
}

/**
 * Reconciles the realm named by the request with the realm of an invitation token
 * (both are realm team ids, null = global):
 *  - an invitation into a different realm is INVALID_INVITATION;
 *  - an invitation into a team that belongs to no realm is allowed at any realm: the
 *    realm stays the requested one and the invitation only adds the team (D4);
 *  - an invitation into a realm with no explicit realm implies that realm, but only
 *    where `allowImplied` is set (flows that issue no session straight away).
 */
export function reconcileInvitationRealm(
  explicitRealmId: string | null | undefined,
  inviteRealmId: string | null | undefined,
  allowImplied: boolean,
): string | null {
  const explicit = explicitRealmId ? String(explicitRealmId) : null;
  const invite = inviteRealmId ? String(inviteRealmId) : null;
  if (explicit === invite) return explicit;
  if (invite === null) return explicit;
  if (explicit === null && allowImplied) return invite;
  throw new ModuleError(errors.INVALID_INVITATION);
}

/** Whether a user's home realm is the given realm (null/absent = global). */
export function isHomeRealm(
  userHomeRealm: unknown,
  realmId: string | null | undefined,
): boolean {
  const home = userHomeRealm ? String(userHomeRealm) : null;
  const realm = realmId ? String(realmId) : null;
  return home === realm;
}

/**
 * Whether a strategy is enabled in the global module config. Keys are the strategy
 * names ('local', 'username', 'magicLink', 'phone', 'metamask', 'biometric') or
 * `oauth.<provider>`, which is available when the provider is enabled with complete
 * credentials (the rule the OAuth handlers use, see isGlobalOAuthAvailable).
 * Unknown keys throw, so a typo cannot silently read as disabled.
 */
export function isGlobalStrategyEnabled(
  config: Record<string, any> | null | undefined,
  strategyKey: string,
): boolean {
  if (strategyKey.startsWith('oauth.')) {
    const provider = strategyKey.slice('oauth.'.length);
    if (!(REALM_OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
      throw new Error(`Unknown strategy: ${strategyKey}`);
    }
    return isGlobalOAuthAvailable(provider, config?.[provider]);
  }
  switch (strategyKey) {
    case 'local':
      return config?.local?.enabled === true;
    case 'username':
      return config?.local?.username_auth_enabled === true;
    case 'magicLink':
      return config?.magic_link?.enabled === true;
    case 'phone':
      return config?.phoneAuthentication?.enabled === true;
    case 'metamask':
      return config?.metamask?.enabled === true;
    case 'biometric':
      return config?.biometricAuthentication?.enabled === true;
    default:
      throw new Error(`Unknown strategy: ${strategyKey}`);
  }
}

/**
 * Whether a brand-new anonymous user may hold a session in its home realm. An anonymous
 * user has no 2FA and no verified email, so a realm that requires either (or pins its
 * clients) refuses the session. Evaluated BEFORE the user is created, so a refused
 * registration never leaves an orphan user behind. Returns the error key to throw, or
 * null when the session is allowed.
 */
export function anonymousRealmDenial(
  realmId: string,
  policies: RealmPolicies,
  clientId: string,
): keyof typeof errors | null {
  const result = evaluateRealmAccess({
    requestedRealm: realmId,
    userHomeRealm: realmId,
    membershipType: null,
    policies,
    homePolicies: null,
    assurance: { authorized: true, hasTwoFA: false, isVerified: false, clientId },
  });
  return result.allowed ? null : result.error;
}

/** Outcome of the guest lookup of an identifier at a realm (see decideGuestPrincipal). */
export type GuestPrincipalDecision<T> =
  { outcome: 'none' } | { outcome: 'one'; user: T } | { outcome: 'many'; count: number };

/**
 * Picks the account an identifier resolves to among the guests of a realm, after the home
 * lookup of the realm found nothing:
 *  - direct sign-in off: none (linked guests sign in at their home realm);
 *  - a holder whose home realm is this realm is not a guest here and is ignored;
 *  - exactly one holder with a guest membership in the realm: that holder;
 *  - more than one: an invariant breach (see realm.logic `assertRealmPrincipalFree`), which
 *    the caller refuses instead of picking one of them.
 * `holders` are the accounts holding the identifier anywhere, `guestUserIds` the ids of the
 * accounts with a guest membership in `realmId`.
 */
export function decideGuestPrincipal<
  T extends { _id: unknown; homeRealm?: unknown },
>(params: {
  realmId: string;
  directSignIn: boolean;
  holders: readonly T[];
  guestUserIds: readonly string[];
}): GuestPrincipalDecision<T> {
  if (!params.directSignIn) return { outcome: 'none' };
  const realm = String(params.realmId);
  const guests = new Set(params.guestUserIds.map(String));
  const matches = params.holders.filter(holder => {
    const home = holder.homeRealm ? String(holder.homeRealm) : null;
    return home !== realm && guests.has(String(holder._id));
  });
  if (matches.length === 0) return { outcome: 'none' };
  if (matches.length === 1) return { outcome: 'one', user: matches[0] };
  return { outcome: 'many', count: matches.length };
}

/** Result of the guest gate (see decideGuestSignIn). `ok: false` reads as "not found". */
export type GuestSignInGate = { ok: true } | { ok: false };

/**
 * Whether a principal that is a guest of realm R may sign in at R with a strategy. Every
 * condition must hold, and a refusal is answered like an unknown identifier by the caller:
 *  - direct sign-in is on at R;
 *  - the strategy is enabled at R;
 *  - the strategy is enabled at the guest's home realm (the global config for a global home).
 *    `homeStrategyEnabled` is null when the home realm is missing or inactive.
 */
export function decideGuestSignIn(params: {
  directSignIn: boolean;
  strategyAtRealm: boolean;
  homeStrategyEnabled: boolean | null;
}): GuestSignInGate {
  const ok =
    params.directSignIn && params.strategyAtRealm && params.homeStrategyEnabled === true;
  return ok ? { ok: true } : { ok: false };
}

/**
 * The `verificationRequired` of a password check (`authenticateChecks`) at a realm. A home
 * principal meets its realm's rule. A guest also meets its home realm's rule, so the stricter
 * of the two applies.
 */
export function passwordVerificationRequired(params: {
  via: 'home' | 'guest';
  realmRequired: boolean;
  homeRequired: boolean;
}): boolean {
  if (params.via === 'home') return params.realmRequired;
  return params.realmRequired || params.homeRequired;
}
