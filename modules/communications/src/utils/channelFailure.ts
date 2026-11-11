import {
  ConduitGrpcSdk,
  isGrpcStatusError,
  ModuleErrorDefinition,
  parseErrorPayload,
} from '@conduitplatform/grpc-sdk';

/**
 * Client-safe description of a failure that is reported as a value (e.g. inside a
 * ChannelResult) instead of being thrown. Typed errors keep their message and code,
 * anything else is replaced by `fallback` and only logged.
 */
export function channelFailure(
  error: unknown,
  fallback: ModuleErrorDefinition,
): { error: string; conduitCode: string } {
  const payload = parseErrorPayload(error);
  if (payload.conduitCode) {
    return { error: payload.message, conduitCode: payload.conduitCode };
  }
  if (isGrpcStatusError(error) && payload.message) {
    return { error: payload.message, conduitCode: fallback.conduitCode };
  }
  ConduitGrpcSdk.Logger.error(
    `[${fallback.conduitCode}] ${fallback.message}: ${payload.message}`,
  );
  return { error: fallback.message, conduitCode: fallback.conduitCode };
}
