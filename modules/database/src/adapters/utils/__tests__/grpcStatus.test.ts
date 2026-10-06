import { describe, expect, it } from '@jest/globals';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { grpcStatusFromError } from '../grpcStatus.js';

describe('grpcStatusFromError', () => {
  it('preserves typed GrpcError codes instead of collapsing them to INTERNAL', () => {
    expect(
      grpcStatusFromError(new GrpcError(status.INVALID_ARGUMENT, 'bad filter')),
    ).toEqual({
      code: status.INVALID_ARGUMENT,
      message: 'bad filter',
    });
    expect(
      grpcStatusFromError(new GrpcError(status.PERMISSION_DENIED, 'no subject')),
    ).toEqual({
      code: status.PERMISSION_DENIED,
      message: 'no subject',
    });
  });

  it('maps unknown errors to INTERNAL', () => {
    expect(grpcStatusFromError(new Error('boom'))).toEqual({
      code: status.INTERNAL,
      message: 'boom',
    });
  });
});
