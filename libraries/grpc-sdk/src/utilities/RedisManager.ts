import { Cluster, ClusterOptions, Redis, RedisOptions } from 'ioredis';

export type RedisClusterDetails = {
  nodes: { host: string; port: number }[];
  options: ClusterOptions;
  /** accepted as an alias of options.keyPrefix */
  keyPrefix?: string;
};
export type RedisDetails = RedisOptions | RedisClusterDetails;

function isCluster(details: unknown): details is RedisClusterDetails {
  return !!details && Object.prototype.hasOwnProperty.call(details, 'nodes');
}

/**
 * Reads the deployment-wide key prefix from connection details
 * (`keyPrefix` for standalone, `options.keyPrefix` or `keyPrefix` for cluster).
 */
export function getRedisKeyPrefix(details?: RedisDetails): string {
  if (!details) return '';
  if (isCluster(details)) {
    return details.options?.keyPrefix ?? details.keyPrefix ?? '';
  }
  return details.keyPrefix ?? '';
}

/**
 * Returns a copy of the connection details carrying `prefix` as the deployment-wide
 * key prefix (`keyPrefix` for standalone, `options.keyPrefix` for cluster).
 * An empty/undefined prefix leaves the details untouched.
 */
export function withRedisKeyPrefix<T extends RedisDetails>(
  details: T,
  prefix?: string,
): T {
  if (!prefix) return details;
  if (isCluster(details)) {
    const { keyPrefix: _ignored, ...rest } = details;
    return { ...rest, options: { ...rest.options, keyPrefix: prefix } } as T;
  }
  return { ...details, keyPrefix: prefix } as T;
}

/**
 * Creates ioredis clients for a Conduit deployment.
 *
 * A deployment-wide key prefix (REDIS_KEY_PREFIX, or `keyPrefix` in REDIS_CONFIG / the
 * details served by Core) is applied to every key, composed with any per-client prefix:
 * `getClient({ keyPrefix: 'bus_' })` uses `<global>bus_`. ioredis does not prefix pub/sub
 * channels or KEYS/SCAN patterns, so pub/sub users must apply `prefix` themselves.
 */
export class RedisManager {
  redisConnection: RedisDetails;
  /** Deployment-wide key/channel prefix, '' when unset. */
  readonly prefix: string;

  constructor(redisDetails?: RedisDetails) {
    this.prefix = getRedisKeyPrefix(redisDetails);
    if (isCluster(redisDetails)) {
      const { keyPrefix: _ignored, ...rest } = redisDetails;
      const options = { ...rest.options };
      delete options.keyPrefix;
      this.redisConnection = { ...rest, options };
    } else {
      const connection: RedisOptions = { ...redisDetails, maxRetriesPerRequest: null };
      delete connection.keyPrefix;
      this.redisConnection = connection;
    }
  }

  /**
   * Returns a new client whose keys are prefixed with `<global prefix><options.keyPrefix>`.
   */
  getClient(options?: RedisOptions): Redis | Cluster {
    const keyPrefix = this.prefix + (options?.keyPrefix ?? '');
    return this.createClient({ ...options, keyPrefix });
  }

  /**
   * Returns a new client WITHOUT any key prefix (not even the global one). Callers are
   * responsible for namespacing their keys under `prefix` themselves.
   */
  getUnprefixedClient(options?: RedisOptions): Redis | Cluster {
    return this.createClient({ ...options, keyPrefix: '' });
  }

  /**
   * Connection settings for BullMQ Queue/Worker/QueueEvents. BullMQ rejects ioredis
   * clients that carry a keyPrefix, so the client is unprefixed and the deployment
   * prefix is passed through BullMQ's own `prefix` option (defaults to 'bull').
   */
  getBullMQOptions(): { connection: Redis | Cluster; prefix: string } {
    return { connection: this.getUnprefixedClient(), prefix: this.bullMQPrefix };
  }

  /** BullMQ `prefix` option for this deployment ('bull' when no global prefix is set). */
  get bullMQPrefix(): string {
    return `${this.prefix}bull`;
  }

  private createClient(options: RedisOptions): Redis | Cluster {
    const { keyPrefix, ...rest } = options;
    if (isCluster(this.redisConnection)) {
      return new Cluster(this.redisConnection.nodes, {
        ...this.redisConnection.options,
        ...(keyPrefix ? { keyPrefix } : {}),
      });
    }
    const connection: RedisOptions = { ...this.redisConnection, ...rest };
    if (keyPrefix) {
      connection.keyPrefix = keyPrefix;
    }
    return new Redis(connection);
  }
}
