import IORedis, { Redis, RedisOptions } from 'ioredis';

export class RedisManager {
  redisConnection: RedisOptions;

  constructor(redisIp: string, redisPort: any) {
    this.redisConnection = {
      host: redisIp,
      port: redisPort,
    };
  }

  getClient(connectionOps?: any): Redis {
    return new IORedis({ ...this.redisConnection, ...connectionOps });
  }
}
