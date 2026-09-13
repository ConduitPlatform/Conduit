export const EVENTS_NAMESPACE = '/events/';
export const EVENT_RELAY_REFRESH_CHANNEL = 'router:event-relays:refresh';
export const EVENT_RELAY_SUBSCRIBER_PREFIX = 'event-relay:';

export const MAX_TEMPLATE_BYTES = 16 * 1024;
export const MAX_OUTPUT_BYTES = 64 * 1024;
export const MAX_TEMPLATE_DEPTH = 10;
export const MAX_PATH_SEGMENTS = 8;
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 256;
export const MAX_BUS_EVENT_LENGTH = 128;
export const MAX_SOCKET_EVENT_LENGTH = 64;
export const MAX_RESOURCE_TYPE_LENGTH = 64;
export const MAX_RESOURCE_ID_LENGTH = 128;
export const MAX_RESOURCE_ID_PATH_LENGTH = 128;
export const MAX_PERMISSION_LENGTH = 64;

export const MAX_INBOUND_BUS_BYTES = 256 * 1024;
export const RECONCILE_INTERVAL_MS = 30_000;
export const MAX_SUBSCRIBE_PER_MINUTE = 30;
export const MAX_ROOMS_PER_SOCKET = 32;
export const RELAY_REBAC_TTL_MS = 12_000;

export const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export const RESERVED_SOCKET_EVENTS = new Set([
  'connect',
  'disconnect',
  'connect_error',
  'error',
  'join-room',
  'leave-room',
  'conduit_error',
  'subscribe',
  'unsubscribe',
  'ping',
  'pong',
]);
