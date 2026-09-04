import { requireOwnPath } from './path.js';
import { eventRelayRoom } from './rooms.js';
import { renderMessageTemplate } from './template.js';
import { validateResourceId } from './validation.js';
import { EventRelayValidationError } from './validationError.js';

export type RelayProcessInput = {
  _id: string;
  busEvent: string;
  socketEvent: string;
  resourceIdPath: string;
  messageTemplate: unknown;
};

export type RelayEmission = {
  relayId: string;
  busEvent: string;
  socketEvent: string;
  room: string;
  data: unknown;
};

export type RelayFailure = {
  relayId: string;
  busEvent: string;
  reason: string;
};

export type ProcessResult = {
  emissions: RelayEmission[];
  failures: RelayFailure[];
};

export function parseBusPayload(rawMessage: string): unknown {
  if (typeof rawMessage !== 'string' || rawMessage.trim() === '') {
    throw new EventRelayValidationError('Bus payload is empty');
  }
  try {
    return JSON.parse(rawMessage);
  } catch {
    throw new EventRelayValidationError('Bus payload is not valid JSON');
  }
}

export function buildRelayEmissions(
  relays: RelayProcessInput[],
  payload: unknown,
): ProcessResult {
  const emissions: RelayEmission[] = [];
  const failures: RelayFailure[] = [];

  for (const relay of relays) {
    try {
      const resourceId = validateResourceId(
        requireOwnPath(payload, relay.resourceIdPath, 'Resource ID path'),
      );
      const data = renderMessageTemplate(relay.messageTemplate, payload);
      emissions.push({
        relayId: relay._id,
        busEvent: relay.busEvent,
        socketEvent: relay.socketEvent,
        room: eventRelayRoom(relay._id, resourceId),
        data,
      });
    } catch (err) {
      failures.push({
        relayId: relay._id,
        busEvent: relay.busEvent,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { emissions, failures };
}
