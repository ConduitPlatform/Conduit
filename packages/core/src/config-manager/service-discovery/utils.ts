/*
 * Registers a timeout with linear backoff.
 * onFailure() only runs on rep exhaustion.
 * Timeout can be cleared through returned clear() or inside onTry().
 */
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
