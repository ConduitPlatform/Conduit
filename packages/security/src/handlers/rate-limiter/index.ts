import { RedisClient } from 'redis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { ConduitError } from '@conduitplatform/grpc-sdk';

export class RateLimiter {
  private _limiter: any;

  constructor(redisHost: string, redisPort: number) {
    let redisClient: RedisClient = new RedisClient({
      host: redisHost,
      port: redisPort,
      enable_offline_queue: false,
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

  get limiter() {
    const self = this;
    return (req: any, res: any, next: any) => {
      let ip =
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
