import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import {
  EffectiveAuthSettings,
  evaluateRealmAccess,
  RealmPolicies,
  withHomeScope,
} from '../utils/realm.logic.js';

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
 * names ('local', 'username', 'magicLink', 'phone', 'metamask', 'biometric').
 * Unknown keys throw, so a typo cannot silently read as disabled.
 */
export function isGlobalStrategyEnabled(
  config: Record<string, any> | null | undefined,
  strategyKey: string,
): boolean {
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
    assurance: { authorized: true, hasTwoFA: false, isVerified: false, clientId },
  });
  return result.allowed ? null : result.error;
}
