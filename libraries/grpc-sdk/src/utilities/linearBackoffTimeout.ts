/**
 * Registers a timeout with linear backoff.
 * onFailure() only runs on rep exhaustion.
 * Timeout can be cleared through returned clear() or inside onTry().
 */
import { clearTimeout } from 'timers';

export function linearBackoffTimeout(
  onTry: (timeout: NodeJS.Timeout) => void,
  delay: number,
  reps?: number,
  onFailure?: () => void,
) {
  const nextRep = () => reps === undefined || --reps > 0;
  let timeout: NodeJS.Timeout | null;
  const invoker = async () => {
    delay = Math.floor(delay * 2);
    if (delay > 0 && nextRep()) {
      timeout = setTimeout(invoker, delay);
      onTry(timeout);
    } else {
      timeout = null;
      onFailure && onFailure();
    }
  };
  timeout = setTimeout(invoker, delay);
  return {
    clear: () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    },
  };
}

/**
 * Registers a timeout with linear backoff.
 * onFailure() only runs on rep exhaustion.
 * @param {() => Promise<boolean>} onTry - Async handler, returns 'continue' boolean flag
 */
export async function linearBackoffTimeoutAsync(
  onTry: () => Promise<boolean>,
  delay: number,
  reps?: number,
  onFailure?: () => void | Promise<void>,
  startNow = false,
) {
  const nextRep = () => reps === undefined || --reps > 0;
  const invoker = async () => {
    delay = Math.floor(delay * 2);
    if (delay > 0 && nextRep()) {
      if (await onTry()) setTimeout(invoker, delay);
    } else {
      onFailure && (await onFailure());
    }
  };
  setTimeout(invoker, startNow ? 0 : delay);
}
