/*
 * Registers a timeout with exponential backoff.
 * onFailure() only runs on rep exhaustion.
 * Timeout can be cleared through returned clear() or inside onTry().
 */
export function exponentialTimeout(
  onTry: (timeout: NodeJS.Timeout) => Promise<void>,
  delay: number,
  reps?: number,
  onFailure?: () => Promise<void>,
) {
  const nextRep = () => reps === undefined || --reps > 0;
  let timeout: NodeJS.Timeout | null;
  const invoker = async () => {
    delay = Math.floor(delay * 2);
    if (delay > 0 && nextRep()) {
      timeout = setTimeout(invoker, delay);
      await onTry(timeout);
    } else {
      timeout = null;
      onFailure && (await onFailure());
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
