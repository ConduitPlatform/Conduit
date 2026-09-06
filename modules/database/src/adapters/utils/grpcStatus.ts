import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export function grpcStatusFromError(err: unknown): { code: status; message: string } {
  if (err instanceof GrpcError) {
    return { code: err.code, message: err.message };
  }
  return {
    code: status.INTERNAL,
    message: err instanceof Error ? err.message : String(err),
  };
}

export function callerModuleName(metadata?: {
  get(key: string): Array<string | Buffer>;
}): string | undefined {
  const value = metadata?.get('module-name')?.[0];
  if (typeof value === 'string' && value.length > 0) return value;
  if (Buffer.isBuffer(value) && value.length > 0) return value.toString();
  return undefined;
}
