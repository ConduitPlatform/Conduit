import { GrpcError } from '@conduitplatform/grpc-sdk';
import moment from 'moment';
import { Token } from '../../../models/index.js';
import { TokenType } from '../../../constants/index.js';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';

export async function validateStateToken(state: string): Promise<Token> {
  // only a state token is accepted here: any other token value cannot start or finish a flow
  const stateToken: Token | null = await Token.getInstance().findOne(
    { token: state, tokenType: TokenType.STATE_TOKEN },
    { readPreference: 'primary' },
  );
  if (isNil(stateToken))
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid parameters');
  if (moment().isAfter(moment(stateToken.data.expiresAt))) {
    await Token.getInstance().deleteOne(stateToken);
    throw new GrpcError(status.INVALID_ARGUMENT, 'Token expired');
  }
  return stateToken;
}
