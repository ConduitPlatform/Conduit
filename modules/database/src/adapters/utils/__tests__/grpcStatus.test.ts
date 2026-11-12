import { describe, expect, it } from '@jest/globals';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { grpcStatusFromError } from '../grpcStatus.js';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';

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

describe('grpcStatusFromError with typed errors', () => {
  it('keeps the conduitCode payload of a ModuleError', () => {
    const result = grpcStatusFromError(new ModuleError(errors.SCHEMA_NOT_FOUND, 'Users'));
    expect(result.code).toBe(status.NOT_FOUND);
    expect(JSON.parse(result.message)).toEqual({
      message: errors.SCHEMA_NOT_FOUND.message,
      conduitCode: 'SCHEMA_NOT_FOUND',
    });
  });
});
