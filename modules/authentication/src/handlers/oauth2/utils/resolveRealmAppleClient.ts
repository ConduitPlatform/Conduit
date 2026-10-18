import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';
import { ResolvedAppleOAuthClient } from '../interfaces/AppleProviderConfig.js';
import { hasCompleteOAuthCredentials, OAuthCredentials } from './oauthSettings.logic.js';

/**
 * Composes the Apple client of a request that may belong to a realm.
 *
 *  - The realm entry has its own `clientId`: the realm's `clientId` and `redirect_uri`
 *    are used. The key triple (`privateKey`, `teamId`, `keyId`) is all-or-nothing: the
 *    realm's when it sets all three, otherwise the global triple (both already
 *    resolved into `effective`, see `buildEffectiveSettings`). The global `clients[]`
 *    list and an `oauthClientId` param are not consulted.
 *  - The realm entry has no `clientId` (or there is no realm): `resolveGlobal` runs, i.e.
 *    the existing `resolveAppleOAuthClient(oauthClientId)` resolution, with the realm's
 *    own `redirect_uri` taking precedence when it sets one.
 */
export function resolveRealmAppleClient(input: {
  /** The realm's own, non-inherited Apple `clientId` (null/empty = inherits). */
  realmClientId: string | null | undefined;
  /** The realm's own, non-inherited `redirect_uri` (null/empty = inherits). */
  realmRedirectUri?: string | null;
  /** Effective (realm over global) Apple credentials of the realm. */
  effective: OAuthCredentials | null | undefined;
  resolveGlobal: () => ResolvedAppleOAuthClient;
}): ResolvedAppleOAuthClient {
  const { realmClientId, effective } = input;
  const ownRedirect =
    typeof input.realmRedirectUri === 'string' && input.realmRedirectUri !== ''
      ? input.realmRedirectUri
      : undefined;
  if (!effective || typeof realmClientId !== 'string' || realmClientId.trim() === '') {
    const global = input.resolveGlobal();
    return ownRedirect ? { ...global, redirect_uri: ownRedirect } : global;
  }
  if (!hasCompleteOAuthCredentials('apple', { ...effective, clientId: realmClientId })) {
    throw new ModuleError(errors.STRATEGY_NOT_AVAILABLE_FOR_REALM);
  }
  return {
    clientId: realmClientId,
    redirect_uri: ownRedirect ?? effective.redirect_uri ?? '',
    privateKey: effective.privateKey!,
    teamId: effective.teamId!,
    keyId: effective.keyId!,
  };
}
