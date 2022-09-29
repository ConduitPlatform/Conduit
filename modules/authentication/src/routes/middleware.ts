import {
  ConfigController,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { AuthUtils } from '../utils/auth';
import { AccessToken } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { JwtPayload } from 'jsonwebtoken';
import moment from 'moment/moment';

export default async function (
  call: ParsedRouterRequest,
): Promise<UnparsedRouterResponse> {
  const context = call.request.context;
  const headers = call.request.headers;

  const header = (headers['Authorization'] || headers['authorization']) as string;
  if (isNil(header)) {
    throw new GrpcError(status.UNAUTHENTICATED, 'No authorization header present');
  }
  const args = header.split(' ');
  if (args.length !== 2) {
    throw new GrpcError(status.UNAUTHENTICATED, 'Authorization header malformed');
  }

  if (args[0] !== 'Bearer') {
    throw new GrpcError(
      status.UNAUTHENTICATED,
      "The Authorization header must be prefixed by 'Bearer '",
    );
  }
  const payload: string | JwtPayload | null = AuthUtils.verify(
    args[1],
    ConfigController.getInstance().config.accessTokens.jwtSecret,
  );
  if (!payload || typeof payload === 'string' || !payload.exp) {
    throw new GrpcError(status.UNAUTHENTICATED, 'Invalid token');
  }
  if (moment().isAfter(moment().milliseconds(payload.exp!))) {
    throw new GrpcError(
      status.UNAUTHENTICATED,
      'Token is expired or otherwise not valid',
    );
  }
  if (
    !(payload as JwtPayload).authorized &&
    call.request.path !== '/authentication/twoFa/verify'
  ) {
    throw new GrpcError(status.UNAUTHENTICATED, '2FA is required');
  }
  const accessToken = await AccessToken.getInstance().findOne(
    {
      token: args[1],
      clientId: context.clientId,
    },
    undefined,
    ['user'],
  );
  if (!accessToken || !accessToken.user) {
    throw new GrpcError(
      status.UNAUTHENTICATED,
      'Token is expired or otherwise not valid',
    );
  }
  return { user: accessToken.user, jwtPayload: payload };
}
