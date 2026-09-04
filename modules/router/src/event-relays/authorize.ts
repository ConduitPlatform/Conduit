import { status } from '@grpc/grpc-js';
import { eventRelayRoom } from './rooms.js';
import { validateResourceId } from './validation.js';
import { EventRelayValidationError } from './validationError.js';

export class RelaySubscriptionError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'RelaySubscriptionError';
  }
}

export type RelaySubscriptionTarget = {
  _id: string;
  permission: string;
  resourceType: string;
};

export type RelayAuthorizationSdk = {
  isAvailable: (module: string) => boolean;
  authorization?: {
    can: (request: {
      subject: string;
      actions: string[];
      resource: string;
    }) => Promise<{ allow: boolean }>;
  } | null;
};

export type RelayLookup = {
  getActiveRelay(id: string): RelaySubscriptionTarget | undefined;
};

export async function authorizeRelaySubscription(
  grpcSdk: RelayAuthorizationSdk,
  manager: RelayLookup,
  userId: string | undefined,
  relayId: unknown,
  resourceId: unknown,
  onDenied?: () => void,
): Promise<string> {
  if (!userId) {
    throw new RelaySubscriptionError(status.UNAUTHENTICATED, 'Authentication required');
  }
  if (typeof relayId !== 'string' || relayId.trim() === '') {
    throw new RelaySubscriptionError(status.INVALID_ARGUMENT, 'Relay ID is required');
  }

  let validatedResourceId: string;
  try {
    validatedResourceId = validateResourceId(resourceId);
  } catch (err) {
    throw toSubscriptionError(err);
  }

  const relay = manager.getActiveRelay(relayId);
  if (!relay) {
    throw new RelaySubscriptionError(status.NOT_FOUND, 'Event relay not found');
  }

  if (!grpcSdk.authorization || !grpcSdk.isAvailable('authorization')) {
    onDenied?.();
    throw new RelaySubscriptionError(status.UNAVAILABLE, 'Authorization is unavailable');
  }

  let allowed = false;
  try {
    const decision = await grpcSdk.authorization.can({
      subject: `User:${userId}`,
      actions: [relay.permission],
      resource: `${relay.resourceType}:${validatedResourceId}`,
    });
    allowed = decision.allow;
  } catch {
    onDenied?.();
    throw new RelaySubscriptionError(status.UNAVAILABLE, 'Authorization check failed');
  }

  if (!allowed) {
    onDenied?.();
    throw new RelaySubscriptionError(status.PERMISSION_DENIED, 'Permission denied');
  }

  return eventRelayRoom(relay._id, validatedResourceId);
}

export function toSubscriptionError(err: unknown): RelaySubscriptionError {
  if (err instanceof EventRelayValidationError) {
    return new RelaySubscriptionError(status.INVALID_ARGUMENT, err.message);
  }
  if (err instanceof RelaySubscriptionError) {
    return err;
  }
  return new RelaySubscriptionError(
    status.INTERNAL,
    err instanceof Error ? err.message : 'Unexpected error',
  );
}
