import {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitString,
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { Config } from '../config/index.js';
import { errors } from '../errors.js';
import { previousKeyActive, rotate } from '../utils/signingKeys.logic.js';

export const SIGNING_KEYS_LOCK = 'authentication:signingKeys';

export interface SigningKeysAdminDeps {
  /** the applied config of this replica */
  getConfig: () => Config;
  /** the persisted config, null when it cannot be read (rotation is then refused) */
  readPersisted: () => Promise<Config | null>;
  /** persists the full config (override) */
  persist: (next: Config) => Promise<void>;
  /** applies the config locally: convict and ConfigController */
  syncConfig: (next: Config) => void;
  /** publishes the full config on `authentication:config:update` */
  publish: (configJson: string) => void;
  withLock: <T>(resource: string, ttl: number, fn: () => Promise<T>) => Promise<T>;
  now?: () => number;
}

export class SigningKeysAdmin {
  constructor(private readonly deps?: SigningKeysAdminDeps) {}

  /**
   * Rotates the access token signing keypair under the cluster lock: the current key
   * becomes the previous one (accepted until 2 * accessTokens.expiryPeriod from now), a
   * new current key is minted, the config is persisted, applied locally and published so
   * every replica and verifier picks up the new key. A second rotation while the previous
   * key is still active is refused unless `force: true`.
   */
  async rotate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const deps = this.deps;
    if (!deps) {
      throw new ModuleError(errors.AUTH_CONFIG_PERSISTENCE_UNAVAILABLE);
    }
    const force = call.request.params?.force === true;
    const now = deps.now ?? Date.now;
    return deps.withLock(SIGNING_KEYS_LOCK, 10_000, async () => {
      const local = deps.getConfig();
      if (local.accessTokens.mode !== 'jwt') {
        throw new ModuleError(errors.SIGNING_KEYS_NOT_APPLICABLE);
      }
      // the persisted block is the truth: this replica may not have seen a peer's rotation
      const persisted = await deps.readPersisted();
      if (!persisted) {
        throw new ModuleError(
          errors.AUTH_CONFIG_PERSISTENCE_UNAVAILABLE,
          'Unable to read the persisted config',
        );
      }
      const current = persisted.accessTokens?.signing ?? local.accessTokens.signing;
      if (!force && previousKeyActive(current, now())) {
        throw new ModuleError(errors.PREVIOUS_SIGNING_KEY_ACTIVE);
      }
      const signing = rotate(current, now(), local.accessTokens.expiryPeriod);
      const next: Config = {
        ...local,
        accessTokens: { ...local.accessTokens, signing },
      };
      await deps.persist(next);
      deps.syncConfig(next);
      deps.publish(JSON.stringify(next));
      return { kid: signing.kid, previousKid: signing.previousKid };
    });
  }

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/signing-keys/rotate',
        action: ConduitRouteActions.POST,
        description:
          'Rotates the jwt-mode access token signing keypair. The previous key keeps verifying tokens until twice the access token expiry has passed; a further rotation in that window needs force: true.',
        bodyParams: {
          force: ConduitBoolean.Optional,
        },
        errors: [
          errors.AUTH_CONFIG_PERSISTENCE_UNAVAILABLE,
          errors.SIGNING_KEYS_NOT_APPLICABLE,
          errors.PREVIOUS_SIGNING_KEY_ACTIVE,
          errors.SIGNING_KEYS_UNAVAILABLE,
        ],
      },
      new ConduitRouteReturnDefinition('RotateSigningKeys', {
        kid: ConduitString.Required,
        previousKid: ConduitString.Required,
      }),
      this.rotate.bind(this),
    );
  }
}
