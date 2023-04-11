import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/grpc-sdk';
import { GraphQLError } from 'graphql/error';

export const errorHandler = (err: Error | ConduitError | any) => {
  ConduitGrpcSdk.Logger.error(err);
  if (err.hasOwnProperty('status')) {
    throw new GraphQLError(err.message, {
      extensions: { code: (err as ConduitError).status.toString() },
      originalError: err,
    });
  } else if (err.hasOwnProperty('code')) {
    let statusCode: string;
    let name: string;
    switch (err.code) {
      case 3:
        name = 'INVALID_ARGUMENTS';
        statusCode = '400';
        throw new GraphQLError(err.details, {
          extensions: { code: statusCode },
          originalError: err,
        });
      case 5:
        name = 'NOT_FOUND';
        statusCode = '404';
        throw new GraphQLError(err.details, {
          extensions: { code: statusCode },
          originalError: err,
        });
      case 7:
        name = 'FORBIDDEN';
        statusCode = '403';
        throw new GraphQLError(err.details, {
          extensions: { code: statusCode },
          originalError: err,
        });
      case 16:
        name = 'UNAUTHORIZED';
        statusCode = '401';
        throw new GraphQLError(err.details, {
          extensions: { code: statusCode },
          originalError: err,
        });
      default:
        name = 'INTERNAL_SERVER_ERROR';
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
