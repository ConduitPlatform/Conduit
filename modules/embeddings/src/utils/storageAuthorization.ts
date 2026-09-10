import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const STORAGE_AUTHORIZATION_REASONS = [
  'storage_unavailable',
  'authorization_unavailable',
  'storage_authorization_disabled',
] as const;

export type StorageAuthorizationReason = (typeof STORAGE_AUTHORIZATION_REASONS)[number];

export type StorageAuthorizationState =
  { usable: true } | { usable: false; reason: StorageAuthorizationReason };

const STORAGE_AUTHORIZATION_MESSAGES: Record<StorageAuthorizationReason, string> = {
  storage_unavailable:
    'Storage is unavailable; conduit-storage sources require usable Storage ReBAC',
  authorization_unavailable:
    'Authorization is unavailable; conduit-storage sources require usable Storage ReBAC',
  storage_authorization_disabled:
    'Storage authorization is disabled; conduit-storage sources require usable Storage ReBAC. Selectors are not a tenant boundary.',
};

export function storageAuthorizationMessage(
  state: Extract<StorageAuthorizationState, { usable: false }>,
): string {
  return STORAGE_AUTHORIZATION_MESSAGES[state.reason];
}

export function storageAuthorizationWarnings(
  state?: StorageAuthorizationState,
): string[] {
  if (!state || state.usable) return [];
  return [storageAuthorizationMessage(state)];
}

export function assertStorageAuthorizationUsable(
  state?: StorageAuthorizationState,
): void {
  if (state?.usable) return;
  throw new GrpcError(
    status.FAILED_PRECONDITION,
    storageAuthorizationMessage(
      state ?? { usable: false, reason: 'authorization_unavailable' },
    ),
  );
}

export async function resolveStorageAuthorizationState(input: {
  storageAvailable: boolean;
  authorizationAvailable: boolean;
  getStorageConfig?: () => Promise<{ authorization?: { enabled?: boolean } }>;
}): Promise<StorageAuthorizationState> {
  if (!input.storageAvailable) {
    return { usable: false, reason: 'storage_unavailable' };
  }
  if (!input.authorizationAvailable) {
    return { usable: false, reason: 'authorization_unavailable' };
  }
  if (!input.getStorageConfig) {
    return { usable: false, reason: 'storage_authorization_disabled' };
  }
  try {
    const storageConfig = await input.getStorageConfig();
    if (storageConfig?.authorization?.enabled !== true) {
      return { usable: false, reason: 'storage_authorization_disabled' };
    }
  } catch {
    return { usable: false, reason: 'storage_unavailable' };
  }
  return { usable: true };
}
