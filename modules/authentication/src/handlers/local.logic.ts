import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { TokenType } from '../constants/index.js';
import { Token, User } from '../models/index.js';
import { AuthUtils } from '../utils/index.js';

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
    throw new GrpcError(status.PERMISSION_DENIED, 'Anonymous user');
  }
  if (isNil(user.hashedPassword)) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'User does not use password authentication',
    );
  }
  if (isNil(user.email) || user.email.trim() === '') {
    throw new GrpcError(status.FAILED_PRECONDITION, 'User has no email address');
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
    throw new GrpcError(
      status.INTERNAL,
      'There was an error sending the email. Please try again later.',
    );
  }
  await grpcSdk.emailProvider
    .sendEmail('ForgotPassword', {
      email: user.email,
      variables: {
        link,
        user: safeUser,
      },
    })
    .catch(() => {
      throw new GrpcError(
        status.INTERNAL,
        'There was an error sending the email. Please try again later.',
      );
    });
}
