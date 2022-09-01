import { ApolloError } from 'apollo-server-express';
import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/grpc-sdk';

export const errorHandler = (err: Error | ConduitError | any) => {
  ConduitGrpcSdk.Logger.error(err);
  if (err.hasOwnProperty('status')) {
    throw new ApolloError(err.message, (err as ConduitError).status.toString(), err);
  } else if (err.hasOwnProperty('code')) {
    let statusCode: string;
    let name: string;
    switch (err.code) {
      case 3:
        name = 'INVALID_ARGUMENTS';
        statusCode = '400';
        throw new ApolloError(err.details, statusCode, err);
      case 5:
        name = 'NOT_FOUND';
        statusCode = '404';
        throw new ApolloError(err.details, statusCode, err);
      case 7:
        name = 'FORBIDDEN';
        statusCode = '403';
        throw new ApolloError(err.details, statusCode, err);
      case 16:
        name = 'UNAUTHORIZED';
        statusCode = '401';
        throw new ApolloError(err.details, statusCode, err);
      default:
        name = 'INTERNAL_SERVER_ERROR';
        throw new ApolloError(err.details, '500', err);
    }
  } else {
    throw new ApolloError(err.message, '500', err);
  }
};
