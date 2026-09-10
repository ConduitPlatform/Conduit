import { createHash } from 'node:crypto';

export function hashedQueueJobId(prefix: string, parts: readonly string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(`${Buffer.byteLength(part, 'utf8')}:`);
    hash.update(part);
    hash.update('\0');
  }
  return `${prefix}_${hash.digest('hex')}`;
}

export function isBullMqCompatibleJobId(jobId: string): boolean {
  return (
    jobId.length > 0 &&
    jobId.length <= 128 &&
    !jobId.includes(':') &&
    `${Number.parseInt(jobId, 10)}` !== jobId
  );
}
