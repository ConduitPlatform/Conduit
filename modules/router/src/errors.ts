import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

/**
 * Errors of the router module. Token and session errors (AUTH_TOKEN_MISSING, TOKEN_*,
 * SESSION_REVOKED, TWO_FA_REQUIRED, CLIENT_ID_MISSING...) are shared and live in
 * `authErrors` of `@conduitplatform/module-tools`. The HTTP rate limit reuses Hermes'
 * `RATE_LIMIT_EXCEEDED`.
 */
export const errors = defineErrors({
  // Security clients
  CLIENT_CREDENTIALS_INVALID: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Unauthorized',
    description:
      'The security client id, secret or domain sent with the request is not valid',
  },
  EXPLORER_DISABLED_IN_PRODUCTION: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Unauthorized',
    description:
      'The GraphQL explorer, Swagger and API reference pages are disabled in production',
  },
  PLATFORM_NOT_SUPPORTED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Platform not supported',
    description: 'The platform must be one of the supported client platforms',
  },
  INVALID_CLIENT_ALIAS: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Non-null alias field should not be an empty string',
    description: 'When an alias is given it must not be empty',
  },
  CLIENT_ALIAS_TAKEN: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'A security client with this alias already exists',
    description: 'Choose a different alias',
  },
  SECURITY_CLIENT_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Security client not found',
    description: 'No security client matches the given id',
  },
  CLIENT_DOMAIN_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Platform WEB requires domain name',
    description: 'Clients of the WEB platform must have a domain',
  },
  INVALID_CLIENT_DOMAIN: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid domain argument',
    description:
      'The domain is not a valid domain name or contains more than one wildcard',
  },

  // Route middlewares
  INVALID_ROUTE_ACTION: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid action',
    description: 'The action must be one of GET, POST, PUT, PATCH, DELETE, UPDATE',
  },
  GRPC_ROUTE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Route not found',
    description: 'No registered route matches the given path and action',
  },
  MIDDLEWARE_PATCH_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to patch route middlewares',
    description: 'The middlewares of the route could not be updated',
  },
  ROUTE_REGISTRATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to register routes',
    description: 'The routes of the module could not be registered',
  },
  SOCKET_PUSH_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to push socket event',
    description: 'The socket event could not be delivered',
  },

  // Event relays (admin)
  EVENT_RELAY_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Event relay not found',
    description: 'No active event relay matches the given id',
  },
  EVENT_RELAY_NAME_TAKEN: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'An event relay with this name already exists',
    description: 'Choose a different event relay name',
  },
  EVENT_RELAY_FIELD_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'A required event relay field is missing',
    description: 'A required event relay field is empty',
  },
  EVENT_RELAY_NAME_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Name must be 1-64 characters and start with a letter or number',
    description: 'The event relay name does not match the allowed format',
  },
  EVENT_RELAY_NOTES_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Notes are too long',
    description: 'The event relay notes exceed the maximum length',
  },
  EVENT_RELAY_BUS_EVENT_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Bus event must be an exact channel name with no wildcards',
    description: 'The bus event must be an exact channel name without wildcards',
  },
  EVENT_RELAY_SOCKET_EVENT_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Socket event must be a non-reserved event name',
    description: 'The socket event name is malformed or reserved',
  },
  EVENT_RELAY_RESOURCE_TYPE_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Resource type is invalid',
    description: 'The resource type does not match the allowed format',
  },
  EVENT_RELAY_PATH_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Path is invalid',
    description:
      'A payload path is empty, too long, has too many segments or an invalid segment',
  },
  EVENT_RELAY_PERMISSION_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Permission is invalid',
    description: 'The permission does not match the allowed format',
  },
  EVENT_RELAY_TEMPLATE_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Message template is invalid',
    description:
      'The message template is missing, is not valid JSON, is too large or is nested too deeply',
  },
  EVENT_RELAY_PAYLOAD_PATH_NOT_FOUND: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'A referenced path was not found on the payload',
    description: 'A placeholder or resource id path does not exist on the payload',
  },
  EVENT_RELAY_RENDERED_MESSAGE_TOO_LARGE: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Rendered message is too large',
    description: 'The rendered message exceeds the maximum allowed size',
  },
  EVENT_RELAY_SAMPLE_PAYLOAD_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Sample payload is invalid',
    description: 'The sample payload is not valid JSON or is too large',
  },
  EVENT_RELAY_BUS_PAYLOAD_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Bus payload is invalid',
    description: 'The bus message is empty or is not valid JSON and was dropped',
  },
  EVENT_RELAY_BUS_PAYLOAD_TOO_LARGE: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Bus payload is too large',
    description: 'The bus message exceeds the maximum inbound size and was dropped',
  },

  // Event relays (sockets)
  RESOURCE_ID_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Resource ID is invalid',
    description: 'The resource id must be a string without whitespace or colons',
  },
  RELAY_ID_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Relay ID is required',
    description: 'Provide the id of the event relay',
  },
  EVENT_RELAY_AUTH_REQUIRED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Authentication required',
    description: 'Only authenticated connections can subscribe to event relays',
  },
  EVENT_RELAY_PERMISSION_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Permission denied',
    description: 'You are not allowed to subscribe to this resource',
  },
  EVENT_RELAY_AUTHORIZATION_UNAVAILABLE: {
    grpcCode: status.UNAVAILABLE,
    message: 'Authorization is unavailable',
    description: 'The permission check could not be completed; retry shortly',
  },
  SUBSCRIBE_RATE_LIMIT_EXCEEDED: {
    grpcCode: status.RESOURCE_EXHAUSTED,
    message: 'Subscribe rate limit exceeded',
    description: 'Too many subscribe requests; wait a minute and retry',
  },
  RELAY_SUBSCRIPTION_LIMIT_EXCEEDED: {
    grpcCode: status.RESOURCE_EXHAUSTED,
    message: 'Too many relay subscriptions on this socket',
    description: 'Unsubscribe from some relay rooms before subscribing to more',
  },
  EVENT_RELAY_SUBSCRIPTION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Event relay subscription failed',
    description: 'The subscription could not be processed',
  },
});
