import { RedisManager } from './RedisManager.js';
import { Cluster, Redis } from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { Indexable } from '../interfaces/index.js';

export enum KNOWN_LOCKS {
  STATE_MODIFICATION = 'state_modification',
}

export class StateManager {
  private readonly redisClient: Redis | Cluster;
  private readonly redLock: Redlock;

  constructor(redisManager: RedisManager, name: string) {
    this.redisClient = redisManager.getClient({ keyPrefix: name + '_' });
    this.redLock = new Redlock([this.redisClient as any], {
      // The expected clock drift; for more details see:
      // http://redis.io/topics/distlock
      driftFactor: 0.01, // multiplied by lock ttl to determine drift time
      // The max number of times Redlock will attempt to lock a resource
      // before error.
      retryCount: 10,

      // the time in ms between attempts
      retryDelay: 100, // time in ms
      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 200, // time in ms
      // The minimum remaining time on a lock before an extension is automatically
      // attempted with the `using` API.
      // automaticExtensionThreshold: 500, // time in ms
    });

    process.on('exit', () => {
      this.redisClient.quit();
    });
  }

  async acquireLock(resource: string, ttl: number = 5000): Promise<Lock> {
    return await this.redLock.acquire([resource], ttl);
  }

  async releaseLock(lock: Lock) {
    await lock.unlock();
  }

  async modifyState(modifier: (state: Indexable) => Promise<Indexable>) {
    const lock = await this.acquireLock(KNOWN_LOCKS.STATE_MODIFICATION);
    try {
      const retrievedState = (await this.getState()) ?? '{}';
      const currentState = JSON.parse(retrievedState);
      const newState = await modifier(currentState);
      await this.setState(JSON.stringify(newState));
    } finally {
      await this.releaseLock(lock);
    }
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
