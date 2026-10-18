import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { EffectiveAuthSettings, withHomeScope } from '../utils/realm.logic.js';

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
 *  - they must agree, otherwise INVALID_INVITATION;
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
