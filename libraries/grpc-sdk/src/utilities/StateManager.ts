import { RedisManager } from './RedisManager.js';
import { Cluster, Redis } from 'ioredis';
import { Indexable } from '../interfaces/index.js';
import {
  ExecutionError,
  Lock,
  Redlock,
  ResourceLockedError,
} from '@sesamecare-oss/redlock';

export enum KNOWN_LOCKS {
  STATE_MODIFICATION = 'state_modification',
  VIEW_CREATION = 'view_creation',
}

export async function isLockContention(error: unknown): Promise<boolean> {
  if (error instanceof ResourceLockedError) {
    return true;
  }
  if (!(error instanceof ExecutionError)) {
    return false;
  }

  const attempts = await Promise.all(error.attempts);
  const voteErrors = attempts.flatMap(attempt =>
    Array.from(attempt.votesAgainst.values()),
  );

  return (
    voteErrors.length > 0 &&
    voteErrors.every(voteError => voteError instanceof ResourceLockedError)
  );
}

const CONSUME_KEY_IF_MATCHES_SCRIPT = `
local stored = redis.call('GET', KEYS[1])
if not stored then return 0 end
if stored == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 1
end
local attempts = redis.call('INCR', KEYS[2])
if attempts >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1], KEYS[2])
elseif attempts == 1 then
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl > 0 then redis.call('PEXPIRE', KEYS[2], ttl) end
end
return 0
`;

export class StateManager {
  private readonly redisClient: Redis | Cluster;
  private readonly redLock: Redlock;

  constructor(redisManager: RedisManager, name: string) {
    this.redisClient = redisManager.getClient({ keyPrefix: name + '_' });
    this.redLock = new Redlock([this.redisClient], {
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
      automaticExtensionThreshold: 500, // time in ms
    });

    process.on('exit', () => {
      this.redisClient.quit();
    });
  }

  async acquireLock(resource: string, ttl: number = 5000): Promise<Lock> {
    return await this.redLock.acquire([resource], ttl);
  }

  /**
   * Attempt to acquire a lock once. Returns null when another holder owns the
   * resource (contention). Re-throws Redis/infrastructure failures.
   */
  async tryAcquireLock(resource: string, ttl: number = 5000): Promise<Lock | null> {
    try {
      return await this.redLock.acquire([resource], ttl, { retryCount: 0 });
    } catch (error) {
      if (await isLockContention(error)) {
        return null;
      }
      throw error;
    }
  }

  async releaseLock(lock: Lock) {
    await lock.release();
  }

  async withLock<T>(resource: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const lock = await this.acquireLock(resource, ttl);
    try {
      return await fn();
    } finally {
      await this.releaseLock(lock);
    }
  }

  /**
   * Auto-extends the lease while `fn` runs. `fn` must check `signal.aborted`
   * after awaited work and must not publish a result after the lease is lost.
   */
  async usingLock<T>(
    resource: string,
    ttl: number,
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return this.redLock.using([resource], ttl, async signal => fn(signal));
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

  /**
   * Deletes keyName and resolves true when it holds value. A mismatch is counted in
   * attemptsKey (expiring with keyName), and the maxAttempts-th mismatch deletes keyName.
   * Both keys must share a hash tag for Redis Cluster.
   */
  async consumeKeyIfMatches(
    keyName: string,
    attemptsKey: string,
    value: string,
    maxAttempts: number,
  ): Promise<boolean> {
    const result = await this.redisClient.eval(
      CONSUME_KEY_IF_MATCHES_SCRIPT,
      2,
      keyName,
      attemptsKey,
      value,
      maxAttempts,
    );
    return result === 1;
  }

  incr(keyName: string) {
    return this.redisClient.incr(keyName);
  }
}
