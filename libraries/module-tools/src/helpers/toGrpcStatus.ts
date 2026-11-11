import {
  ConduitGrpcSdk,
  httpStatusToGrpc,
  INTERNAL_ERROR_CODE,
  isGrpcStatusError,
  ModuleErrorDefinition,
  parseErrorPayload,
} from '@conduitplatform/grpc-sdk';

const INTERNAL = 13;

export interface GrpcStatusPayload {
  /** gRPC status answered to the caller. */
  code: number;
  /** gRPC message: plain text, or the `{message, conduitCode}` JSON of a typed error. */
  message: string;
  /** conduitCode carried by the error, if any. */
  conduitCode?: string;
  /** What to write to the module's log. */
  log: string;
}

/**
 * Turns anything a handler threw into the gRPC status it is answered with.
 *
 * - gRPC errors (GrpcError, ModuleError, errors returned by another module) keep their
 *   status and payload.
 * - HTTP-style errors (ConduitError) are mapped to the matching gRPC status instead of
 *   becoming INTERNAL.
 * - Anything else is an unexpected failure: INTERNAL. With `maskUnknown` the client
 *   receives a static message and the INTERNAL_ERROR code, the cause only goes to the log.
 */
export function toGrpcStatus(
  error: unknown,
  options: { maskUnknown?: boolean } = {},
): GrpcStatusPayload {
  if (isGrpcStatusError(error)) {
    const payload = parseErrorPayload(error);
    const debug = (error as { debugLogInfo?: unknown }).debugLogInfo;
    const label = payload.conduitCode
      ? `[${payload.conduitCode}] ${payload.message}`
      : payload.message;
    return {
      code: error.code,
      message: error.details ?? error.message ?? 'Something went wrong',
      conduitCode: payload.conduitCode,
      log: typeof debug === 'string' && debug !== '' ? `${label}: ${debug}` : label,
    };
  }
  const candidate = (error ?? {}) as {
    status?: unknown;
    message?: unknown;
    conduitCode?: unknown;
    stack?: unknown;
  };
  const text =
    typeof candidate.message === 'string' && candidate.message !== ''
      ? candidate.message
      : typeof error === 'string' && error !== ''
        ? error
        : 'Something went wrong';
  if (typeof candidate.status === 'number') {
    const conduitCode =
      typeof candidate.conduitCode === 'string' ? candidate.conduitCode : undefined;
    return {
      code: httpStatusToGrpc(candidate.status),
      message: conduitCode ? JSON.stringify({ message: text, conduitCode }) : text,
      conduitCode,
      log: conduitCode ? `[${conduitCode}] ${text}` : text,
    };
  }
  const log = typeof candidate.stack === 'string' ? candidate.stack : text;
  if (options.maskUnknown) {
    return {
      code: INTERNAL,
      message: JSON.stringify({
        message: 'Something went wrong',
        conduitCode: INTERNAL_ERROR_CODE,
      }),
      conduitCode: INTERNAL_ERROR_CODE,
      log,
    };
  }
  return { code: INTERNAL, message: text, log };
}

/**
 * The `{ code, message }` a gRPC service method answers its callback with:
 *
 *   callback(grpcCallbackError(errors.TEMPLATE_NOT_FOUND));
 *   .catch(e => callback(grpcCallbackError(e, errors.EMAIL_SEND_FAILED)));
 *
 * A definition is sent as a typed error. Anything caught keeps its gRPC status when it
 * has one; otherwise it becomes `fallback` (its message is logged, never sent), or a
 * plain INTERNAL when no fallback is given.
 */
export function grpcCallbackError(
  error: unknown,
  fallback?: ModuleErrorDefinition,
): { code: number; message: string } {
  if (isDefinition(error)) {
    return {
      code: error.grpcCode,
      message: JSON.stringify({ message: error.message, conduitCode: error.conduitCode }),
    };
  }
  if (
    fallback &&
    !isGrpcStatusError(error) &&
    typeof (error as any)?.status !== 'number'
  ) {
    ConduitGrpcSdk.Logger.error(
      `[${fallback.conduitCode}] ${fallback.message}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return grpcCallbackError(fallback);
  }
  const { code, message } = toGrpcStatus(error);
  return { code, message };
}

function isDefinition(value: unknown): value is ModuleErrorDefinition {
  if (!value || typeof value !== 'object' || value instanceof Error) return false;
  const v = value as Partial<ModuleErrorDefinition>;
  return (
    typeof v.grpcCode === 'number' &&
    typeof v.conduitCode === 'string' &&
    typeof v.message === 'string'
  );
}
