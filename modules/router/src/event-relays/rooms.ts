import { createHash } from 'node:crypto';

export function eventRelayRoom(relayId: string, resourceId: string): string {
  const digest = createHash('sha256').update(resourceId).digest('hex');
  return `er:${relayId}:${digest}`;
}
