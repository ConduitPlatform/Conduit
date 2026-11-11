import {
  httpStatusToGrpc,
  INTERNAL_ERROR_CODE,
  isGrpcStatusError,
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
