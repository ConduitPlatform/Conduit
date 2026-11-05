import { getLogger } from './GrpcSdkContext.js';

export class RedisTimeoutError extends Error {
  constructor(ms: number) {
    super(`Redis operation timed out after ${ms}ms`);
  }
}

/**
 * ioredis keeps an offline queue and RedisManager disables request retry limits, so a
 * command against an unreachable Redis never settles. Bound every operation instead.
 */
export function withTimeout<T>(op: () => Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RedisTimeoutError(ms)), ms);
  });
  let pending: Promise<T>;
  try {
    pending = op();
  } catch (e) {
    clearTimeout(timer!);
    return Promise.reject(e);
  }
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}

/** Keeps ioredis reconnect noise from surfacing as unhandled 'error' events. */
export function silenceClientErrors(client: unknown, label: string) {
  const emitter = client as { on?: (event: string, cb: (e: Error) => void) => unknown };
  emitter.on?.('error', (e: Error) => {
    const logger = getLogger() as { debug?: (m: string) => void };
    logger.debug?.(`${label} redis error: ${e?.message}`);
  });
}

export async function inChunks<T>(
  items: T[],
  size: number,
  fn: (chunk: T[]) => Promise<void>,
): Promise<T[]> {
  const failed: T[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    try {
      await fn(chunk);
    } catch {
      failed.push(...chunk);
    }
  }
  return failed;
}
