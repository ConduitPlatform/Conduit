export const MEMBERSHIP_CACHE_TTL_MS = 30 * 1000;

export function getMembershipCacheKey(roomId: string): string {
  return `chat:membership:${roomId}`;
}

export async function invalidateMembershipCache(
  grpcSdk: any,
  roomId: string,
): Promise<void> {
  if (!grpcSdk.state) return;
  await grpcSdk.state.clearKey(getMembershipCacheKey(roomId));
}
