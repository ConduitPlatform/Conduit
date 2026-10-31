import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

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
