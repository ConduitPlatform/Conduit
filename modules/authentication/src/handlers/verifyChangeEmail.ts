import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { TokenType } from '../constants/TokenType.js';

export type VerifiedEmailChangeResult = { redirect: string } | string;

export type ChangeEmailVerificationToken = {
  _id: string;
  data?: { email?: string; customRedirectUri?: string };
  user?: { _id: string } | null;
};

export type VerifyChangeEmailDb = {
  findToken(
    query: object,
    options?: object,
  ): Promise<ChangeEmailVerificationToken | null>;
  deleteToken(query: object): Promise<{ deletedCount?: number } | null | undefined>;
  deleteTokens(query: object): Promise<unknown>;
  findUser(query: object): Promise<{ _id: string } | null>;
  updateUser(id: string, patch: { email: string }): Promise<unknown>;
};

export async function commitVerifiedEmailChange(
  verificationToken: string,
  fallbackRedirectUri: string | undefined,
  db: VerifyChangeEmailDb,
): Promise<VerifiedEmailChangeResult> {
  const token = await db.findToken(
    {
      tokenType: TokenType.CHANGE_EMAIL_TOKEN,
      token: verificationToken,
    },
    { populate: ['user'], readPreference: 'primary' },
  );
  if (!token) {
    throw new GrpcError(status.NOT_FOUND, 'Change email token does not exist');
  }
  const user = token.user;
  if (!user) {
    throw new GrpcError(status.NOT_FOUND, 'User not found');
  }
  const redirectUri = token.data?.customRedirectUri ?? fallbackRedirectUri;

  const removed = await db.deleteToken({
    _id: token._id,
    tokenType: TokenType.CHANGE_EMAIL_TOKEN,
  });
  if (!removed || removed.deletedCount === 0) {
    throw new GrpcError(status.NOT_FOUND, 'Change email token does not exist');
  }

  await db.deleteTokens({
    user: user._id,
    tokenType: TokenType.CHANGE_EMAIL_TOKEN,
  });

  const taken = await db.findUser({
    email: token.data?.email,
    _id: { $ne: user._id },
  });
  if (taken) {
    throw new GrpcError(status.ALREADY_EXISTS, 'Email address already taken');
  }

  await db.updateUser(user._id, { email: token.data?.email as string });
  return redirectUri ? { redirect: redirectUri } : 'Email changed successfully';
}
