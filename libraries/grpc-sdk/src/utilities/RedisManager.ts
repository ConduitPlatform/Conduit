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
  readonly prefix: string;

  constructor(redisDetails?: RedisDetails) {
    if (isCluster(redisDetails)) {
      const { keyPrefix = '', ...options } = redisDetails.options ?? {};
      this.prefix = keyPrefix;
      this.redisConnection = { ...redisDetails, options };
    } else {
      const { keyPrefix = '', ...options } = redisDetails ?? {};
      this.prefix = keyPrefix;
      this.redisConnection = { ...options, maxRetriesPerRequest: null };
    }
  }

  getClient(options?: RedisOptions): Redis | Cluster {
    return this.createClient(options, this.prefix + (options?.keyPrefix ?? ''));
  }

  /** BullMQ rejects clients with a keyPrefix; pair this with `bullMQPrefix`. */
  getUnprefixedClient(options?: RedisOptions): Redis | Cluster {
    return this.createClient(options, '');
  }

  get bullMQPrefix(): string {
    return `${this.prefix}bull`;
  }

  private createClient(options: RedisOptions | undefined, keyPrefix: string) {
    if (isCluster(this.redisConnection)) {
      return new Cluster(this.redisConnection.nodes, {
        ...this.redisConnection.options,
        keyPrefix,
      });
    }
    return new Redis({ ...this.redisConnection, ...options, keyPrefix });
  }
}
