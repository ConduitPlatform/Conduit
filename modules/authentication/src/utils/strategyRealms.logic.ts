import { Indexable } from '@conduitplatform/grpc-sdk';
import { REALM_OAUTH_PROVIDERS } from './realm.logic.js';

const TOGGLE_STRATEGIES = [
  'local',
  'username',
  'magicLink',
  'phone',
  'metamask',
  'biometric',
] as const;

/**
 * Query for the active realms that enable a strategy. Keys are the strategy names
 * ('local', 'username', 'magicLink', 'phone', 'metamask', 'biometric') or
 * `oauth.<provider>`. Unknown keys throw, so a typo cannot silently match nothing.
 */
export function strategyEnabledQuery(strategyKey: string): Indexable {
  const isOAuth = strategyKey.startsWith('oauth.');
  const known = isOAuth
    ? (REALM_OAUTH_PROVIDERS as readonly string[]).includes(
        strategyKey.slice('oauth.'.length),
      )
    : (TOGGLE_STRATEGIES as readonly string[]).includes(strategyKey);
  if (!known) throw new Error(`Unknown realm strategy: ${strategyKey}`);
  return { active: true, [`strategies.${strategyKey}.enabled`]: true };
}
