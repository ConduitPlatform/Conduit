import { Cluster, Redis } from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';

export class RateLimiter {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    const redisClient: Redis | Cluster = this.grpcSdk.redisManager.getClient({
      enableOfflineQueue: false,
    });
    const config = ConfigController.getInstance().config.rateLimit;
    this._limiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'mainLimiter',
      points: config.maxRequests,
      duration: config.resetInterval,
      blockDuration: 10,
      execEvenly: false,
    });
  }

  updateConfig() {
    const config = ConfigController.getInstance().config.rateLimit;
    this._limiter.points = config.maxRequests;
    this._limiter.duration = config.resetInterval;
  }

  private _limiter: RateLimiterRedis;

  get limiter() {
    const self = this;
    return (req: any, res: any, next: any) => {
      if (req.method === 'OPTIONS') return next();
      const ip =
        req.headers['cf-connecting-ip'] ||
        req.headers['x-original-forwarded-for'] ||
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.ip;
      self._limiter
        .consume(ip)
        .then(() => {
          next();
        })
        .catch((rateLimiterRes: RateLimiterRes) => {
          ConduitGrpcSdk.Logger.info(
            `RATE_LIMIT: ${ip} exceeded rate limit, ${rateLimiterRes.consumedPoints} consumed.
             ${rateLimiterRes.msBeforeNext} before next request is allowed.`,
          );
          next(new ConduitError('RATE_LIMIT', 429, 'Too Many Requests'));
        });
    };
  }
}
