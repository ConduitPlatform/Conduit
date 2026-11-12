import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';
import moment from 'moment';
import { Token } from '../../../models/index.js';
import { TokenType } from '../../../constants/index.js';
import { isNil } from 'lodash-es';

export async function validateStateToken(state: string): Promise<Token> {
  // only a state token is accepted here: any other token value cannot start or finish a flow
  const stateToken: Token | null = await Token.getInstance().findOne(
    { token: state, tokenType: TokenType.STATE_TOKEN },
    { readPreference: 'primary' },
  );
  if (isNil(stateToken)) throw new ModuleError(errors.OAUTH_STATE_INVALID);
  if (moment().isAfter(moment(stateToken.data.expiresAt))) {
    await Token.getInstance().deleteOne(stateToken);
    throw new ModuleError(errors.OAUTH_STATE_INVALID, 'state token expired');
  }
  return stateToken;
}
