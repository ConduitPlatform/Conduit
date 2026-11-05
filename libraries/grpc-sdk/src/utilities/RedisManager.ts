import { Cluster, ClusterOptions, Redis, RedisOptions } from 'ioredis';

type RedisClusterDetails = {
  nodes: { host: string; port: number }[];
  options: ClusterOptions;
};
type RedisDetails = RedisOptions | RedisClusterDetails;

function isCluster(details: unknown): details is RedisClusterDetails {
  return !!details && Object.prototype.hasOwnProperty.call(details, 'nodes');
}

/** Returns a copy of the connection details with `prefix` as the deployment-wide key prefix. */
export function withRedisKeyPrefix<T extends RedisDetails>(
  details: T,
  prefix?: string,
): T {
  if (!prefix) return details;
  if (isCluster(details)) {
    return { ...details, options: { ...details.options, keyPrefix: prefix } };
  }
  return { ...details, keyPrefix: prefix };
}

/**
 * The deployment-wide key prefix is composed with per-client prefixes
 * (`getClient({ keyPrefix: 'bus_' })` uses `<prefix>bus_`). ioredis does not prefix
 * pub/sub channels, so pub/sub users must apply `prefix` themselves.
 */
export class RedisManager {
  redisConnection: RedisDetails;
  /** Deployment-wide prefix, always ending with ':' when set. */
  readonly prefix: string;

  constructor(redisDetails?: RedisDetails) {
    let keyPrefix: string;
    if (isCluster(redisDetails)) {
      const { keyPrefix: p = '', ...options } = redisDetails.options ?? {};
      keyPrefix = p;
      this.redisConnection = { ...redisDetails, options };
    } else {
      const { keyPrefix: p = '', ...options } = redisDetails ?? {};
      keyPrefix = p;
      this.redisConnection = { ...options, maxRetriesPerRequest: null };
    }
    // a separator keeps prefixes like 'app' and 'app2' from overlapping
    this.prefix = keyPrefix && !keyPrefix.endsWith(':') ? `${keyPrefix}:` : keyPrefix;
  }

  getClient(options?: RedisOptions): Redis | Cluster {
    return this.createClient(options, this.prefix + (options?.keyPrefix ?? ''));
  }

  /** BullMQ rejects clients with a keyPrefix; use with `bullMQOptions`. */
  getUnprefixedClient(options?: RedisOptions): Redis | Cluster {
    return this.createClient(options, '');
  }

  /** Queue/Worker options placing BullMQ keys under the deployment prefix. */
  bullMQOptions(connection: Redis | Cluster) {
    // Cluster needs a hash tag so all of a queue's keys share a slot
    const prefix = isCluster(this.redisConnection)
      ? `{${this.prefix}bull}`
      : `${this.prefix}bull`;
    return { connection, prefix };
  }

  private createClient(options: RedisOptions | undefined, keyPrefix: string) {
    const { keyPrefix: _, ...rest } = options ?? {};
    if (isCluster(this.redisConnection)) {
      const clusterOptions = this.redisConnection.options;
      return new Cluster(this.redisConnection.nodes, {
        ...clusterOptions,
        keyPrefix,
        redisOptions: {
          ...clusterOptions.redisOptions,
          ...rest,
          maxRetriesPerRequest: null,
        },
      });
    }
    return new Redis({ ...this.redisConnection, ...rest, keyPrefix });
  }
}
