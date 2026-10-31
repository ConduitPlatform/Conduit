import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

/**
 * Takes the email verification code with one Redis GETDEL. A second caller, including a
 * concurrent one, sees an empty key and is rejected.
 */
export async function consumeEmailVerificationCode(
  getDel: (key: string) => Promise<string | null>,
  key: string,
  code: string,
): Promise<void> {
  const stored = await getDel(key);
  if (!stored || stored !== code) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid verification code');
  }
}
