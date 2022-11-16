import IORedis, { Redis, RedisOptions } from 'ioredis';

export class RedisManager {
  redisConnection: RedisOptions;

  constructor(
    redisIp?: string,
    redisPort?: any,
    redisUsername?: string,
    redisPassword?: string,
    sentinels?: any[],
    name?: string,
  ) {
    this.redisConnection = {
      host: redisIp,
      port: redisPort,
      username: redisUsername,
      password: redisPassword,
      sentinels: sentinels,
      name: name,
    };
  }
  getClient(connectionOps?: RedisOptions): Redis {
    return new IORedis({ ...this.redisConnection, ...connectionOps });
  }
}
