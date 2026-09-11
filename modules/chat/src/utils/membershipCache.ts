export const MEMBERSHIP_CACHE_TTL_MS = 30 * 1000;

export function getMembershipCacheKey(roomId: string): string {
  return `chat:membership:${roomId}`;
}

interface GrpcSdkWithState {
  state?: {
    clearKey(key: string): Promise<number>;
  } | null;
}

export async function invalidateMembershipCache(
  grpcSdk: GrpcSdkWithState,
  roomId: string,
): Promise<void> {
  if (!grpcSdk.state) return;
  await grpcSdk.state.clearKey(getMembershipCacheKey(roomId));
}
