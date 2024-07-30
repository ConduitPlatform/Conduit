import { ConduitGrpcSdk, ConduitError } from '@conduitplatform/grpc-sdk';
import { GraphQLError } from 'graphql';

export const errorHandler = (err: Error | ConduitError | any) => {
  ConduitGrpcSdk.Logger.error(err);
  if (err.hasOwnProperty('status')) {
    throw new GraphQLError(err.message, {
      extensions: { code: (err as ConduitError).status.toString() },
      originalError: err,
    });
  } else if (err.hasOwnProperty('code')) {
    switch (err.code) {
      case 3:
        throw new GraphQLError(err.details, {
          extensions: { code: '400' },
          originalError: err,
        });
      case 5:
        throw new GraphQLError(err.details, {
          extensions: { code: '404' },
          originalError: err,
        });
      case 7:
        throw new GraphQLError(err.details, {
          extensions: { code: '403' },
          originalError: err,
        });
      case 16:
        throw new GraphQLError(err.details, {
          extensions: { code: '401' },
          originalError: err,
        });
      default:
        throw new GraphQLError(err.details, {
          extensions: { code: '500' },
          originalError: err,
        });
    }
  } else {
    throw new GraphQLError(err.message, {
      extensions: { code: '500' },
      originalError: err,
    });
  }
};
