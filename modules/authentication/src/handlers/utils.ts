import {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { User } from '../models/index.js';
import { Config } from '../config/index.js';
import { AuthUtils } from '../utils/index.js';

export async function changePassword(
  call: ParsedRouterRequest,
): Promise<UnparsedRouterResponse> {
  if (!call.request.context.jwtPayload.sudo) {
    throw new GrpcError(status.PERMISSION_DENIED, 'Re-login required to enter sudo mode');
  }
  const { user } = call.request.context;
  const { newPassword } = call.request.bodyParams;
  const hashedPassword = await AuthUtils.hashPassword(newPassword);
  await User.getInstance().findByIdAndUpdate(user._id, { hashedPassword });
  return 'Password changed successfully';
}

export async function authenticateChecks(password: string, config: Config, user: User) {
  if (!user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
  if (!user.hashedPassword)
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'User does not use password authentication',
    );
  const passwordsMatch = await AuthUtils.checkPassword(password, user.hashedPassword);
  if (!passwordsMatch)
    throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');

  if (config.local.verification.required && !user.isVerified) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'You must verify your account to login',
    );
  }
}
