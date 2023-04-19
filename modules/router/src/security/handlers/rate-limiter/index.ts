import { Cluster, Redis } from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/grpc-sdk';

export class RateLimiter {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    const redisClient: Redis | Cluster = this.grpcSdk.redisManager.getClient({
      enableOfflineQueue: false,
    });
    this._limiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'mainLimiter',
      points: 50, // 10 requests
      duration: 1, // per 1 second by IP
      blockDuration: 10,
      // inmemoryBlockOnConsumed: 10,
      execEvenly: false,
    });
  }

  private _limiter: RateLimiterRedis;

  get limiter() {
    const self = this;
    return (req: any, res: any, next: any) => {
      const ip =
        req.headers['cf-connecting-ip'] ||
        req.headers['x-original-forwarded-for'] ||
        req.headers['x-forwarded-for'] ||
        req.ip;
      self._limiter
        .consume(ip)
        .then(() => {
          next();
        })
        .catch(() => {
          next(new ConduitError('RATE_LIMIT', 429, 'Too Many Requests'));
        });
    };
  }
}
