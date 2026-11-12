import { ConduitGrpcSdk, ConduitError } from '@conduitplatform/grpc-sdk';
import { GraphQLError } from 'graphql';
import { toErrorResponse } from '../../utils/errors.js';

/**
 * Rethrows a resolver failure as a GraphQLError whose extensions carry the HTTP-style
 * `code` and, for typed errors, the `conduitCode`.
 */
export const errorHandler = (err: Error | ConduitError | any) => {
  const { status, message, conduitCode } = toErrorResponse(err);
  ConduitGrpcSdk.Logger.error(
    conduitCode && status < 500 ? `[${conduitCode}] ${message}` : err,
  );
  // Errors raised in-process (ConduitError) have always reported their code as a string.
  const inProcess = err && typeof err === 'object' && typeof err.status === 'number';
  throw new GraphQLError(message, {
    extensions: {
      code: inProcess || typeof err?.code !== 'number' ? status.toString() : status,
      ...(conduitCode ? { conduitCode } : {}),
    },
    originalError: err instanceof Error ? err : undefined,
  });
};
