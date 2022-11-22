import IORedis, { Cluster, ClusterOptions, Redis, RedisOptions } from 'ioredis';

export class RedisManager {
  redisConnection:
    | RedisOptions
    | { nodes: { host: string; port: number }[]; options: ClusterOptions };

  constructor(
    redisDetails?:
      | RedisOptions
      | { nodes: { host: string; port: number }[]; options: ClusterOptions },
  ) {
    this.redisConnection = {
      ...redisDetails,
    };
  }
  getClient(
    options?:
      | RedisOptions
      | { nodes: { host: string; port: number }[]; options: ClusterOptions },
  ): Redis | Cluster {
    if (this.redisConnection.hasOwnProperty('nodes')) {
      const clusterOptions = this.redisConnection as {
        nodes: { host: string; port: number }[];
        options: ClusterOptions;
      };
      return new IORedis.Cluster(clusterOptions.nodes, clusterOptions.options);
    } else {
      return new IORedis({ ...(this.redisConnection as RedisOptions), ...options });
    }
  }
}
