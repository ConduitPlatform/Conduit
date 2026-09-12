import { requireOwnPath } from './path.js';
import { eventRelayRoom } from './rooms.js';
import { renderMessageTemplate } from './template.js';
import { validateResourceId } from './validation.js';

export type RelayCompileInput = {
  _id: string;
  busEvent: string;
  socketEvent: string;
  resourceIdPath: string;
  messageTemplate: unknown;
  permission: string;
  resourceType: string;
};

export type CompiledRelay = {
  relayId: string;
  busEvent: string;
  socketEvent: string;
  permission: string;
  resourceType: string;
  buildEmission: (payload: unknown) => {
    room: string;
    data: unknown;
    resourceId: string;
  };
};

export function compileRelay(relay: RelayCompileInput): CompiledRelay {
  const resourceIdPath = relay.resourceIdPath;
  const template = relay.messageTemplate;
  return {
    relayId: relay._id,
    busEvent: relay.busEvent,
    socketEvent: relay.socketEvent,
    permission: relay.permission,
    resourceType: relay.resourceType,
    buildEmission: (payload: unknown) => {
      const resourceId = validateResourceId(
        requireOwnPath(payload, resourceIdPath, 'Resource ID path'),
      );
      const data = renderMessageTemplate(template, payload);
      return {
        room: eventRelayRoom(relay._id, resourceId),
        data,
        resourceId,
      };
    },
  };
}
