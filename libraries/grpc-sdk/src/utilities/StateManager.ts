import { RedisManager } from './RedisManager';
import { Cluster, Redis } from 'ioredis';

export class StateManager {
  private readonly redisClient: Redis | Cluster;

  constructor(redisManager: RedisManager, name: string) {
    this.redisClient = redisManager.getClient({ keyPrefix: name + '_' });
  }

  setState(stateObj: any) {
    return this.setKey('state', stateObj);
  }

  getState() {
    return this.getKey('state');
  }

  setKey(keyName: string, value: any, expiry?: number) {
    if (expiry) {
      return this.redisClient.set(keyName, value, 'PX', expiry);
    } else {
      return this.redisClient.set(keyName, value);
    }
  }

  clearKey(keyName: string) {
    return this.redisClient.del(keyName);
  }

  getKey(keyName: string) {
    return this.redisClient.get(keyName);
  }
}
