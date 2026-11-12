import { ConduitGrpcSdk, parseErrorPayload } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { isNil } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { TokenType } from '../constants/index.js';
import { Token, User } from '../models/index.js';
import { AuthUtils } from '../utils/index.js';
import { errors } from '../errors.js';

/**
 * Creates a password-reset token and emails the link. Shared by the client
 * forgot-password route and the admin send-reset route. Does not revoke sessions.
 */
export async function issuePasswordReset(
  grpcSdk: ConduitGrpcSdk,
  user: User,
  redirectUri: string,
): Promise<void> {
  if (user.isAnonymous) {
    throw new ModuleError(errors.ANONYMOUS_USER_NOT_ELIGIBLE);
  }
  if (isNil(user.hashedPassword)) {
    throw new ModuleError(errors.PASSWORD_AUTH_NOT_AVAILABLE);
  }
  if (isNil(user.email) || user.email.trim() === '') {
    throw new ModuleError(errors.USER_EMAIL_MISSING);
  }

  const oldToken: Token | null = await Token.getInstance().findOne(
    {
      tokenType: TokenType.PASSWORD_RESET_TOKEN,
      user: user._id,
    },
    { readPreference: 'primary' },
  );
  if (!isNil(oldToken) && AuthUtils.checkResendThreshold(oldToken)) {
    await Token.getInstance().deleteOne(oldToken);
  }

  const passwordResetTokenDoc = await Token.getInstance().create({
    tokenType: TokenType.PASSWORD_RESET_TOKEN,
    user: user._id,
    token: uuid(),
  });
  const safeUser = { ...user };
  delete safeUser.hashedPassword;
  const link = `${redirectUri}?reset_token=${passwordResetTokenDoc.token}`;
  if (!grpcSdk.isAvailable('email') || !grpcSdk.emailProvider) {
    throw new ModuleError(errors.AUTH_EMAIL_DELIVERY_FAILED, 'email module unavailable');
  }
  await grpcSdk.emailProvider
    .sendEmail('ForgotPassword', {
      email: user.email,
      variables: {
        link,
        user: safeUser,
      },
    })
    .catch((e: unknown) => {
      throw new ModuleError(
        errors.AUTH_EMAIL_DELIVERY_FAILED,
        parseErrorPayload(e).message,
      );
    });
}
