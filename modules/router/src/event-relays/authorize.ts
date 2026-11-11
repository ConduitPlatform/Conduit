import type { ModuleErrorDefinition } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { eventRelayRoom } from './rooms.js';
import { validateResourceId } from './validation.js';
import { EventRelayValidationError } from './validationError.js';
import { errors } from '../errors.js';

export class RelaySubscriptionError extends Error {
  /** gRPC status of the definition; `recovery.ts` branches on it. */
  readonly code: number;

  constructor(readonly definition: ModuleErrorDefinition) {
    super(definition.message);
    this.name = 'RelaySubscriptionError';
    this.code = definition.grpcCode;
  }

  get conduitCode(): string {
    return this.definition.conduitCode;
  }

  toModuleError(): ModuleError {
    return new ModuleError(this.definition);
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
    throw new RelaySubscriptionError(errors.EVENT_RELAY_AUTH_REQUIRED);
  }
  if (typeof relayId !== 'string' || relayId.trim() === '') {
    throw new RelaySubscriptionError(errors.RELAY_ID_REQUIRED);
  }

  let validatedResourceId: string;
  try {
    validatedResourceId = validateResourceId(resourceId);
  } catch (err) {
    throw toSubscriptionError(err);
  }

  const relay = manager.getActiveRelay(relayId);
  if (!relay) {
    throw new RelaySubscriptionError(errors.EVENT_RELAY_NOT_FOUND);
  }

  if (!grpcSdk.authorization || !grpcSdk.isAvailable('authorization')) {
    throw new RelaySubscriptionError(errors.EVENT_RELAY_AUTHORIZATION_UNAVAILABLE);
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
    throw new RelaySubscriptionError(errors.EVENT_RELAY_AUTHORIZATION_UNAVAILABLE);
  }

  if (!allowed) {
    onDenied?.();
    throw new RelaySubscriptionError(errors.EVENT_RELAY_PERMISSION_DENIED);
  }

  return eventRelayRoom(relay._id, validatedResourceId);
}

export function toSubscriptionError(err: unknown): RelaySubscriptionError {
  if (err instanceof EventRelayValidationError) {
    return new RelaySubscriptionError(err.toDefinition());
  }
  if (err instanceof RelaySubscriptionError) {
    return err;
  }
  if (err instanceof ModuleError) {
    return new RelaySubscriptionError(err.definition);
  }
  return new RelaySubscriptionError(errors.EVENT_RELAY_SUBSCRIPTION_FAILED);
}
