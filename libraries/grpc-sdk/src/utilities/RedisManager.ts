import IORedis, { Redis, RedisOptions } from 'ioredis';

export class RedisManager {
  redisConnection: RedisOptions;

  constructor(redisDetails?: RedisOptions) {
    this.redisConnection = {
      ...redisDetails,
    };
  }
  getClient(connectionOps?: RedisOptions): Redis {
    return new IORedis({ ...this.redisConnection, ...connectionOps });
  }
}
