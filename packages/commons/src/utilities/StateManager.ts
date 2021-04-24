import { Redis } from 'ioredis';
import { RedisManager } from './RedisManager';

export class StateManager {
  private readonly redisClient: Redis;

  constructor(redisManager: RedisManager, name: string) {
    this.redisClient = redisManager.getClient({ keyPrefix: name });
  }

  setState(stateObj: any): Promise<any> {
    return this.setKey('state', stateObj);
  }

  getState(): Promise<any> {
    return this.getKey('state');
  }

  setKey(keyName: string, value: any, expiry?: number): Promise<any> {
    if (expiry) {
      return this.redisClient.set(keyName, value, 'PX', expiry);
    } else {
      return this.redisClient.set(keyName, value);
    }
  }

  getKey(keyName: string): Promise<any> {
    return this.redisClient.get(keyName);
  }
}
