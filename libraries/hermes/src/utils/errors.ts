import {
  grpcStatusToHttp,
  INTERNAL_ERROR_CODE,
  parseErrorPayload,
} from '@conduitplatform/grpc-sdk';

/**
 * conduitCodes of the errors Hermes raises itself, before a request reaches a module.
 */
export const HermesErrorCodes = {
  /** Body, query or url parameters failed the route's validation. */
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  /** The per-route or per-socket rate limit was exceeded. */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  /** The rate limit could not be checked, so the request was rejected. */
  RATE_LIMIT_UNAVAILABLE: 'RATE_LIMIT_UNAVAILABLE',
  /** The access token of a connected socket expired. */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** A recovered socket failed re-authentication. */
  SOCKET_UNAUTHENTICATED: 'SOCKET_UNAUTHENTICATED',
  /** An unexpected failure with no typed definition. */
  INTERNAL_ERROR: INTERNAL_ERROR_CODE,
} as const;

/** The one error shape every transport (REST, GraphQL, sockets, MCP) answers with. */
export interface ConduitErrorResponse {
  /** HTTP-style error name, e.g. NOT_FOUND. */
  name: string;
  /** HTTP status. */
  status: number;
  /** Human-readable message. */
  message: string;
  /** Stable machine-readable code. Absent on errors that have no typed definition. */
  conduitCode?: string;
}

/**
 * Normalizes anything thrown while serving a request:
 * - `ConduitError` (raised in-process by Hermes, its middlewares or local routes),
 * - gRPC errors returned by a module (typed `ModuleError`s carry a `conduitCode`),
 * - anything else, which is reported as an opaque 500.
 */
export function toErrorResponse(err: unknown): ConduitErrorResponse {
  if (err && typeof err === 'object') {
    const candidate = err as {
      status?: unknown;
      name?: unknown;
      message?: unknown;
      code?: unknown;
      conduitCode?: unknown;
    };
    if (typeof candidate.status === 'number') {
      return {
        name: typeof candidate.name === 'string' ? candidate.name : 'ERROR',
        status: candidate.status,
        message: typeof candidate.message === 'string' ? candidate.message : '',
        ...(typeof candidate.conduitCode === 'string'
          ? { conduitCode: candidate.conduitCode }
          : {}),
      };
    }
    if (typeof candidate.code === 'number') {
      const { name, status } = grpcStatusToHttp(candidate.code);
      const { message, conduitCode } = parseErrorPayload(err);
      return { name, status, message, ...(conduitCode ? { conduitCode } : {}) };
    }
  }
  return {
    name: 'INTERNAL_SERVER_ERROR',
    status: 500,
    message: 'Something went wrong',
    conduitCode: INTERNAL_ERROR_CODE,
  };
}

/**
 * Socket.IO only forwards `message` and `data` of a middleware error to the client's
 * `connect_error` event, so the normalized error travels in `data`.
 */
export function toSocketConnectError(
  err: unknown,
): Error & { data: ConduitErrorResponse } {
  const response = toErrorResponse(err);
  const error = new Error(response.message) as Error & { data: ConduitErrorResponse };
  error.data = response;
  return error;
}
