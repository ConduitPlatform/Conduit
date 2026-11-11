import type { ModuleErrorDefinition } from '../interfaces/Route.js';

/**
 * gRPC status codes, duplicated from `@grpc/grpc-js` as plain numbers so this file has
 * no runtime imports (it is unit tested with type stripping).
 */
const GRPC = {
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
} as const;

/** conduitCode of an error that reached a client without a typed definition. */
export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

type ErrorCatalogEntry = Omit<ModuleErrorDefinition, 'conduitCode'>;

export type ErrorCatalog<T extends Record<string, ErrorCatalogEntry>> = {
  readonly [K in keyof T & string]: Readonly<T[K] & { conduitCode: K }>;
};

/**
 * Builds a module's error catalog. The key of each entry becomes its `conduitCode`, so
 * the two can never drift apart:
 *
 *   export const errors = defineErrors({
 *     FILE_NOT_FOUND: {
 *       grpcCode: status.NOT_FOUND,
 *       message: 'File does not exist',
 *       description: 'No file matches the given id',
 *     },
 *   });
 *
 * Throw them with `new ModuleError(errors.FILE_NOT_FOUND)` and list them in a route's
 * `errors` option so they are published in the Swagger, GraphQL and MCP descriptions.
 */
export function defineErrors<const T extends Record<string, ErrorCatalogEntry>>(
  definitions: T,
): ErrorCatalog<T> {
  const catalog: Record<string, ModuleErrorDefinition> = {};
  for (const key of Object.keys(definitions)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw new Error(`Invalid conduitCode "${key}": use SCREAMING_SNAKE_CASE`);
    }
    catalog[key] = Object.freeze({ ...definitions[key], conduitCode: key });
  }
  return Object.freeze(catalog) as ErrorCatalog<T>;
}

/**
 * Whether `err` carries a gRPC status: a GrpcError / ModuleError thrown locally, or a
 * ServiceError returned by a call to another module. Driver errors that happen to have
 * a numeric `code` (MongoDB's 11000, ...) are not gRPC errors.
 */
export function isGrpcStatusError(
  err: unknown,
): err is Error & { code: number; details?: string } {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { code?: unknown; details?: unknown; isGrpcError?: unknown };
  if (
    typeof candidate.code !== 'number' ||
    !Number.isInteger(candidate.code) ||
    candidate.code < 0 ||
    candidate.code > 16
  ) {
    return false;
  }
  return candidate.isGrpcError === true || typeof candidate.details === 'string';
}

/**
 * The client-facing content of an error. A ModuleError travels as a JSON string
 * (`{"message", "conduitCode"}`) in the gRPC `details` (or, before it crosses the wire,
 * in `message`); anything else is plain text.
 */
export function parseErrorPayload(err: unknown): {
  message: string;
  conduitCode?: string;
} {
  if (typeof err === 'string') return { message: err };
  if (!err || typeof err !== 'object') return { message: '' };
  const { details, message } = err as { details?: unknown; message?: unknown };
  const raw =
    typeof details === 'string' ? details : typeof message === 'string' ? message : '';
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { message?: unknown; conduitCode?: unknown };
      if (parsed && typeof parsed === 'object' && typeof parsed.message === 'string') {
        return {
          message: parsed.message,
          ...(typeof parsed.conduitCode === 'string' && parsed.conduitCode !== ''
            ? { conduitCode: parsed.conduitCode }
            : {}),
        };
      }
    } catch {
      // not a typed error, fall through to the raw text
    }
  }
  return { message: raw };
}

/**
 * The `conduitCode` of an error thrown by this module or returned by a call to another
 * one (`grpcSdk.authentication.userLogin(...)`), or undefined when it has none.
 */
export function getConduitCode(err: unknown): string | undefined {
  return parseErrorPayload(err).conduitCode;
}

/** Whether `err` carries this definition's (or this literal) `conduitCode`. */
export function hasConduitCode(
  err: unknown,
  definition: { conduitCode: string } | string,
): boolean {
  const expected = typeof definition === 'string' ? definition : definition.conduitCode;
  return getConduitCode(err) === expected;
}

/** HTTP status and error name a gRPC status is served as by the REST and GraphQL APIs. */
export function grpcStatusToHttp(grpcCode: number): { name: string; status: number } {
  switch (grpcCode) {
    case GRPC.CANCELLED:
      return { name: 'CLIENT_CLOSED_REQUEST', status: 499 };
    case GRPC.INVALID_ARGUMENT:
      return { name: 'INVALID_ARGUMENTS', status: 400 };
    case GRPC.OUT_OF_RANGE:
      return { name: 'OUT_OF_RANGE', status: 400 };
    case GRPC.DEADLINE_EXCEEDED:
      return { name: 'GATEWAY_TIMEOUT', status: 504 };
    case GRPC.NOT_FOUND:
      return { name: 'NOT_FOUND', status: 404 };
    case GRPC.ALREADY_EXISTS:
      return { name: 'CONFLICT', status: 409 };
    case GRPC.ABORTED:
      return { name: 'ABORTED', status: 409 };
    case GRPC.PERMISSION_DENIED:
      return { name: 'FORBIDDEN', status: 403 };
    case GRPC.RESOURCE_EXHAUSTED:
      return { name: 'TOO_MANY_REQUESTS', status: 429 };
    case GRPC.FAILED_PRECONDITION:
      return { name: 'PRECONDITION_FAILED', status: 412 };
    case GRPC.UNIMPLEMENTED:
      return { name: 'NOT_IMPLEMENTED', status: 501 };
    case GRPC.UNAVAILABLE:
      return { name: 'SERVICE_UNAVAILABLE', status: 503 };
    case GRPC.UNAUTHENTICATED:
      return { name: 'UNAUTHORIZED', status: 401 };
    default:
      return { name: 'INTERNAL_SERVER_ERROR', status: 500 };
  }
}

/**
 * The gRPC status of an HTTP-style error (a `ConduitError`) thrown inside a module, so
 * that it is not served as a 500 once it crosses the gRPC boundary.
 */
export function httpStatusToGrpc(httpStatus: number): number {
  switch (httpStatus) {
    case 400:
    case 422:
      return GRPC.INVALID_ARGUMENT;
    case 401:
      return GRPC.UNAUTHENTICATED;
    case 403:
      return GRPC.PERMISSION_DENIED;
    case 404:
      return GRPC.NOT_FOUND;
    case 409:
      return GRPC.ALREADY_EXISTS;
    case 412:
      return GRPC.FAILED_PRECONDITION;
    case 429:
      return GRPC.RESOURCE_EXHAUSTED;
    case 501:
      return GRPC.UNIMPLEMENTED;
    case 503:
      return GRPC.UNAVAILABLE;
    case 504:
      return GRPC.DEADLINE_EXCEEDED;
    default:
      return GRPC.INTERNAL;
  }
}
