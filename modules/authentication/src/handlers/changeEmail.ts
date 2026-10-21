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

export type ChangeEmailDb = {
  findUser(query: object): Promise<ChangeEmailUser | null>;
  findToken(query: object): Promise<unknown | null>;
  deleteTokens(query: object): Promise<unknown>;
  updateUser(id: string, patch: ChangeEmailPatch): Promise<ChangeEmailUser | null>;
  publish(event: string, payload: string): void;
};

export type ChangeEmailCallback = (
  error: { code: number; message: string } | null,
  result?: { message: string },
) => void;

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
  db: ChangeEmailDb,
): Promise<{ message: string }> {
  const email = present(request.email)?.toLowerCase();
  const userId = present(request.userId);
  const newEmail = (request.newEmail ?? '').toLowerCase();

  if (!email && !userId) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'email or userId is required');
  }

  let user: ChangeEmailUser | null;
  if (userId) {
    user = await db.findUser({ _id: userId });
    if (!user) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    if (email && storedEmail(user.email) !== email) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Email does not match user');
    }
  } else {
    user = await db.findUser({ email });
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

  const duplicate = await db.findUser({ email: newEmail, _id: { $ne: user._id } });
  if (duplicate) {
    throw new GrpcError(status.ALREADY_EXISTS, 'Email address already taken');
  }
  const pending = await db.findToken({
    tokenType: TokenType.CHANGE_EMAIL_TOKEN,
    'data.email': newEmail,
    user: { $ne: user._id },
  });
  if (pending) {
    throw new GrpcError(status.ALREADY_EXISTS, 'Email address already taken');
  }

  await db.deleteTokens({
    user: user._id,
    tokenType: { $in: [...CHANGE_EMAIL_MAILBOX_TOKENS] },
  });

  const patch: ChangeEmailPatch = { email: newEmail };
  if (request.isVerified !== undefined) {
    patch.isVerified = request.isVerified;
  }
  const updated = await db.updateUser(user._id, patch);
  if (!updated) {
    throw new GrpcError(status.INTERNAL, 'Failed to update user');
  }
  db.publish('authentication:update:user', JSON.stringify(updated));
  return { message: 'ok' };
}

export async function changeEmailRpc(
  request: ChangeEmailRequest,
  db: ChangeEmailDb,
  callback: ChangeEmailCallback,
): Promise<void> {
  try {
    const result = await changeUserEmail(request, db);
    callback(null, result);
  } catch (e) {
    if (e instanceof GrpcError) {
      callback({ code: e.code, message: e.message });
      return;
    }
    callback({ code: status.INTERNAL, message: (e as Error).message });
  }
}
