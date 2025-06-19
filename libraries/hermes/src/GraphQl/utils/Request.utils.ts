import { ConduitGrpcSdk, ConduitError } from '@conduitplatform/grpc-sdk';
import { GraphQLError } from 'graphql';
import { mapGrpcErrorToHttp } from '../../Rest/util.js';

export const errorHandler = (err: Error | ConduitError | any) => {
  if (err.hasOwnProperty('status')) {
    ConduitGrpcSdk.Logger.error(err);
    throw new GraphQLError(err.message, {
      extensions: { code: (err as ConduitError).status.toString() },
      originalError: err,
    });
  }
  if (err.hasOwnProperty('code')) {
    const { status } = mapGrpcErrorToHttp(err.code);
    let parsed: { message: string; conduitCode: string } | null = null;
    try {
      parsed = JSON.parse(err.details);
    } catch (e) {
      // The below line is commented out to avoid cluttering the logs since most errors will not have a parsable details field.
      // console.warn('Error parsing details:', e);
    }
    if (parsed && typeof parsed === 'object') {
      ConduitGrpcSdk.Logger.error(parsed.message);
      throw new GraphQLError(parsed.message, {
        extensions: {
          code: status,
          conduitCode: parsed.conduitCode,
        },
        originalError: err,
      });
    } else {
      ConduitGrpcSdk.Logger.error(err);
      throw new GraphQLError(err.details, {
        extensions: { code: status },
        originalError: err,
      });
    }
  }
  ConduitGrpcSdk.Logger.error(err);
  throw new GraphQLError(err.message, {
    extensions: { code: '500' },
    originalError: err,
  });
};
