import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { TokenType } from '../constants/TokenType.js';
import { AuthUtils } from '../utils/index.js';

export const CHANGE_EMAIL_MAILBOX_TOKENS = [
  TokenType.CHANGE_EMAIL_TOKEN,
  TokenType.VERIFICATION_TOKEN,
  TokenType.PASSWORD_RESET_TOKEN,
  TokenType.MAGIC_LINK,
] as const;

export type ChangeEmailUser = {
  _id: string;
  email?: string | null;
  isAnonymous?: boolean;
};

export type ChangeEmailRequest = {
  email?: string;
  newEmail?: string;
  userId?: string;
  isVerified?: boolean;
};

export type ChangeEmailPatch = {
  email: string;
  isVerified?: boolean;
};

export type ChangeEmailStores = {
  findUserById(id: string): Promise<ChangeEmailUser | null>;
  findUserByEmail(email: string): Promise<ChangeEmailUser | null>;
  findOtherUserByEmail(email: string, userId: string): Promise<ChangeEmailUser | null>;
  findOtherChangeEmailToken(email: string, userId: string): Promise<unknown | null>;
  deleteMailboxTokens(userId: string, tokenTypes: readonly string[]): Promise<void>;
  updateUser(id: string, patch: ChangeEmailPatch): Promise<ChangeEmailUser | null>;
  publish(user: ChangeEmailUser): void;
};

function present(value?: string): string | undefined {
  if (value == null || value.length === 0) return undefined;
  return value;
}

function storedEmail(email?: string | null): string | undefined {
  if (email == null || email.length === 0) return undefined;
  return email.toLowerCase();
}

export async function changeUserEmail(
  request: ChangeEmailRequest,
  stores: ChangeEmailStores,
): Promise<{ message: string }> {
  const email = present(request.email)?.toLowerCase();
  const userId = present(request.userId);
  const newEmail = (request.newEmail ?? '').toLowerCase();

  if (!email && !userId) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'email or userId is required');
  }

  let user: ChangeEmailUser | null;
  if (userId) {
    user = await stores.findUserById(userId);
    if (!user) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    if (email && storedEmail(user.email) !== email) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'email does not match user');
    }
  } else {
    user = await stores.findUserByEmail(email!);
    if (!user) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
  }

  const currentEmail = storedEmail(user.email);
  if (currentEmail && currentEmail === newEmail) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'The new email can not be the same as the old email',
    );
  }
  if (user.isAnonymous) {
    throw new GrpcError(status.PERMISSION_DENIED, 'Anonymous user');
  }

  AuthUtils.assertValidEmail(newEmail);

  const duplicate = await stores.findOtherUserByEmail(newEmail, user._id);
  if (duplicate) {
    throw new GrpcError(status.ALREADY_EXISTS, 'Email address already taken');
  }
  const pending = await stores.findOtherChangeEmailToken(newEmail, user._id);
  if (pending) {
    throw new GrpcError(status.ALREADY_EXISTS, 'Email address already taken');
  }

  await stores.deleteMailboxTokens(user._id, CHANGE_EMAIL_MAILBOX_TOKENS);

  const patch: ChangeEmailPatch = { email: newEmail };
  if (request.isVerified !== undefined) {
    patch.isVerified = request.isVerified;
  }
  const updated = await stores.updateUser(user._id, patch);
  if (!updated) {
    throw new GrpcError(status.INTERNAL, 'Failed to update user');
  }
  stores.publish(updated);
  return { message: 'ok' };
}
