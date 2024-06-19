import { Cluster, Redis } from 'ioredis';
import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { isNil } from 'lodash-es';

export class RateLimiter {
  private redisClient: Redis | Cluster;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisClient = this.grpcSdk.redisManager.getClient();
  }

  get limiter() {
    const self = this;
    return (req: any, res: any, next: any) => {
      const config = ConfigController.getInstance().config.rateLimit;
      const prefix = 'limiter';
      const ip = (req.headers['cf-connecting-ip'] ||
        req.headers['x-original-forwarded-for'] ||
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.ip) as string;
      if (req.method === 'OPTIONS') next();
      self.redisClient.incr(`${prefix}:${ip}`, (err, requests) => {
        if (err || isNil(requests) || !requests) {
          ConduitGrpcSdk.Logger.error(
            `RATE_LIMIT: error with redis when processing limit.`,
          );
        }
        if (requests === 1) {
          self.redisClient.expire(`${prefix}:${ip}`, config.resetInterval);
        }
        if (requests! > config.maxRequests) {
          ConduitGrpcSdk.Logger.info(
            `RATE_LIMIT: ${ip} exceeded rate limit, ${requests} consumed.`,
          );
          return next(new ConduitError('RATE_LIMIT', 429, 'Too Many Requests'));
        }
        next();
      });
    };
  }
}
