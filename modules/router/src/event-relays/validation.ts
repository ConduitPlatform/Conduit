import {
  MAX_BUS_EVENT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PERMISSION_LENGTH,
  MAX_RESOURCE_ID_LENGTH,
  MAX_RESOURCE_ID_PATH_LENGTH,
  MAX_RESOURCE_TYPE_LENGTH,
  MAX_SOCKET_EVENT_LENGTH,
  RESERVED_SOCKET_EVENTS,
} from './constants.js';
import { parseDotPath } from './path.js';
import { assertTemplateSize } from './template.js';
import { EventRelayValidationError } from './validationError.js';

export type EventRelayInput = {
  name: string;
  notes?: string;
  active?: boolean;
  busEvent: string;
  socketEvent: string;
  resourceType: string;
  resourceIdPath: string;
  permission: string;
  messageTemplate: unknown;
};

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/;
const BUS_EVENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const SOCKET_EVENT_PATTERN = /^[A-Za-z][A-Za-z0-9_:-]{0,63}$/;
const RESOURCE_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const PERMISSION_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const RESOURCE_ID_PATTERN = /^[^\s:]{1,128}$/;

export function validateEventRelayInput(input: EventRelayInput): EventRelayInput {
  const name = requireTrimmed(input.name, 'Name');
  if (name.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(name)) {
    throw new EventRelayValidationError(
      'Name must be 1-64 characters and start with a letter or number',
    );
  }

  const notes =
    input.notes === undefined || input.notes === ''
      ? undefined
      : requireTrimmed(input.notes, 'Notes');
  if (notes && notes.length > MAX_DESCRIPTION_LENGTH) {
    throw new EventRelayValidationError(
      `Notes must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }

  const busEvent = requireTrimmed(input.busEvent, 'Bus event');
  if (
    busEvent.length > MAX_BUS_EVENT_LENGTH ||
    busEvent.includes('*') ||
    !BUS_EVENT_PATTERN.test(busEvent)
  ) {
    throw new EventRelayValidationError(
      'Bus event must be an exact channel name with no wildcards',
    );
  }

  const socketEvent = requireTrimmed(input.socketEvent, 'Socket event');
  if (
    socketEvent.length > MAX_SOCKET_EVENT_LENGTH ||
    !SOCKET_EVENT_PATTERN.test(socketEvent) ||
    RESERVED_SOCKET_EVENTS.has(socketEvent)
  ) {
    throw new EventRelayValidationError('Socket event must be a non-reserved event name');
  }

  const resourceType = requireTrimmed(input.resourceType, 'Resource type');
  if (
    resourceType.length > MAX_RESOURCE_TYPE_LENGTH ||
    !RESOURCE_TYPE_PATTERN.test(resourceType)
  ) {
    throw new EventRelayValidationError('Resource type is invalid');
  }

  const resourceIdPath = requireTrimmed(input.resourceIdPath, 'Resource ID path');
  if (resourceIdPath.length > MAX_RESOURCE_ID_PATH_LENGTH) {
    throw new EventRelayValidationError('Resource ID path is too long');
  }
  parseDotPath(resourceIdPath, 'Resource ID path');

  const permission = requireTrimmed(input.permission, 'Permission');
  if (permission.length > MAX_PERMISSION_LENGTH || !PERMISSION_PATTERN.test(permission)) {
    throw new EventRelayValidationError('Permission is invalid');
  }

  if (input.messageTemplate === undefined) {
    throw new EventRelayValidationError('Message template is required');
  }
  assertTemplateSize(input.messageTemplate);

  return {
    name,
    notes,
    active: input.active !== false,
    busEvent,
    socketEvent,
    resourceType,
    resourceIdPath,
    permission,
    messageTemplate: input.messageTemplate,
  };
}

export function validateResourceId(resourceId: unknown): string {
  if (typeof resourceId !== 'string' && typeof resourceId !== 'number') {
    throw new EventRelayValidationError('Resource ID must be a string');
  }
  const value = String(resourceId).trim();
  if (
    !value ||
    value.length > MAX_RESOURCE_ID_LENGTH ||
    !RESOURCE_ID_PATTERN.test(value)
  ) {
    throw new EventRelayValidationError('Resource ID is invalid');
  }
  return value;
}

function requireTrimmed(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EventRelayValidationError(`${label} is required`);
  }
  return value.trim();
}
