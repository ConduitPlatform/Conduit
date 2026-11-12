import { grpcCallbackError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';

/**
 * Status and payload a failed gRPC method answers with. Typed and gRPC errors keep their
 * status and `{message, conduitCode}` payload; anything else is INTERNAL.
 */
export function grpcStatusFromError(err: unknown): { code: status; message: string } {
  return grpcCallbackError(err);
}

export function callerModuleName(metadata?: {
  get(key: string): Array<string | Buffer>;
}): string | undefined {
  const value = metadata?.get('module-name')?.[0];
  if (typeof value === 'string' && value.length > 0) return value;
  if (Buffer.isBuffer(value) && value.length > 0) return value.toString();
  return undefined;
}
