import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { RealmSettings } from '../models/index.js';
import { realmsEnabled } from './realm.js';
import { strategyEnabledQuery } from './strategyRealms.logic.js';

export * from './strategyRealms.logic.js';

/**
 * Whether any active realm enables the strategy (one count query). False with realms
 * disabled or when the lookup fails, so route registration never depends on it.
 */
export async function anyRealmEnables(strategyKey: string): Promise<boolean> {
  if (!realmsEnabled()) return false;
  try {
    return (
      (await RealmSettings.getInstance().countDocuments(
        strategyEnabledQuery(strategyKey),
      )) > 0
    );
  } catch (e) {
    ConduitGrpcSdk.Logger.error(e as Error);
    return false;
  }
}

/** A strategy's own `validate()` result OR-ed with realm enablement. */
export async function activeOrRealmEnabled(
  active: unknown,
  strategyKey: string,
): Promise<boolean> {
  return active === true || (await anyRealmEnables(strategyKey));
}
