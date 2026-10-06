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
  const name = parseName(input.name);
  const notes = parseNotes(input.notes);
  const busEvent = parseBusEvent(input.busEvent);
  const socketEvent = parseSocketEvent(input.socketEvent);
  const resourceType = parseResourceType(input.resourceType);
  const resourceIdPath = parseResourceIdPath(input.resourceIdPath);
  const permission = parsePermission(input.permission);
  const messageTemplate = parseMessageTemplate(input.messageTemplate);

  return {
    name,
    notes,
    active: input.active !== false,
    busEvent,
    socketEvent,
    resourceType,
    resourceIdPath,
    permission,
    messageTemplate,
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

function parseName(raw: unknown): string {
  const name = requireTrimmed(raw, 'Name');
  if (name.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(name)) {
    throw new EventRelayValidationError(
      'Name must be 1-64 characters and start with a letter or number',
    );
  }
  return name;
}

function parseNotes(raw: unknown): string | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const notes = requireTrimmed(raw, 'Notes');
  if (notes.length > MAX_DESCRIPTION_LENGTH) {
    throw new EventRelayValidationError(
      `Notes must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }
  return notes;
}

function parseBusEvent(raw: unknown): string {
  const busEvent = requireTrimmed(raw, 'Bus event');
  if (
    busEvent.length > MAX_BUS_EVENT_LENGTH ||
    busEvent.includes('*') ||
    !BUS_EVENT_PATTERN.test(busEvent)
  ) {
    throw new EventRelayValidationError(
      'Bus event must be an exact channel name with no wildcards',
    );
  }
  return busEvent;
}

function parseSocketEvent(raw: unknown): string {
  const socketEvent = requireTrimmed(raw, 'Socket event');
  if (
    socketEvent.length > MAX_SOCKET_EVENT_LENGTH ||
    !SOCKET_EVENT_PATTERN.test(socketEvent) ||
    RESERVED_SOCKET_EVENTS.has(socketEvent)
  ) {
    throw new EventRelayValidationError('Socket event must be a non-reserved event name');
  }
  return socketEvent;
}

function parseResourceType(raw: unknown): string {
  const resourceType = requireTrimmed(raw, 'Resource type');
  if (
    resourceType.length > MAX_RESOURCE_TYPE_LENGTH ||
    !RESOURCE_TYPE_PATTERN.test(resourceType)
  ) {
    throw new EventRelayValidationError('Resource type is invalid');
  }
  return resourceType;
}

function parseResourceIdPath(raw: unknown): string {
  const resourceIdPath = requireTrimmed(raw, 'Resource ID path');
  if (resourceIdPath.length > MAX_RESOURCE_ID_PATH_LENGTH) {
    throw new EventRelayValidationError('Resource ID path is too long');
  }
  parseDotPath(resourceIdPath, 'Resource ID path');
  return resourceIdPath;
}

function parsePermission(raw: unknown): string {
  const permission = requireTrimmed(raw, 'Permission');
  if (permission.length > MAX_PERMISSION_LENGTH || !PERMISSION_PATTERN.test(permission)) {
    throw new EventRelayValidationError('Permission is invalid');
  }
  return permission;
}

function parseMessageTemplate(raw: unknown): unknown {
  if (raw === undefined) {
    throw new EventRelayValidationError('Message template is required');
  }
  assertTemplateSize(raw);
  return raw;
}
