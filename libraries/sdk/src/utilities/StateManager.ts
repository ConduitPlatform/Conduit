import { RedisClient } from 'redis';
import { RedisManager } from './RedisManager';
import { promisify } from 'util';

export class StateManager {
  private readonly redisClient: RedisClient;

  constructor(redisManager: RedisManager, name: string) {
    this.redisClient = redisManager.getClient({ prefix: name });
  }

  setState(stateObj: any): Promise<any> {
    return this.setKey('state', stateObj);
  }

  getState(): Promise<any> {
    return this.getKey('state');
  }

  setKey(keyName: string, value: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.redisClient.set(keyName, value, (err: any, val: any) => {
        if (err) {
          reject(err);
        } else {
          resolve('ok');
        }
      });
    });
  }

  getKey(keyName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.redisClient.get(keyName, (err: any, val: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(val);
        }
      });
    });
  }
}
