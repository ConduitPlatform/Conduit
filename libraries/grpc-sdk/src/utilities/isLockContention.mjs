import { ExecutionError, ResourceLockedError } from '@sesamecare-oss/redlock';

/**
 * JS mirror of isLockContention in StateManager.ts for node:test without a TS loader.
 */
export async function isLockContention(error) {
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
