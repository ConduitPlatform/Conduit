import IORedis from 'ioredis';

export class RedisManager {
  redisConnection: IORedis.RedisOptions;

  constructor(redisIp: string, redisPort: any) {
    this.redisConnection = {
      host: redisIp,
      port: redisPort,
    };
  }

  getClient(connectionOps?: any): IORedis.Redis {
    return new IORedis({ ...this.redisConnection, ...connectionOps });
  }
}
