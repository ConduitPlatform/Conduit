import { GrpcError } from '@conduitplatform/grpc-sdk';
import moment from 'moment';
import { Token } from '../../../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';

export async function validateStateToken(state: string): Promise<Token> {
  const stateToken: Token | null = await Token.getInstance().findOne({
    token: state,
  });
  if (isNil(stateToken))
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid parameters');
  if (moment().isAfter(moment(stateToken.data.expiresAt))) {
    await Token.getInstance().deleteOne(stateToken);
    throw new GrpcError(status.INVALID_ARGUMENT, 'Token expired');
  }
  return stateToken;
}
