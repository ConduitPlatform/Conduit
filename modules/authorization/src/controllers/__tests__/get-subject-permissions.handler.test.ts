import { describe, expect, it, jest } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import {
  GrpcError,
  type GrpcRequest,
  type GrpcResponse,
} from '@conduitplatform/grpc-sdk';
import Authorization from '../../Authorization.js';
import type { SubjectPermissionsRequest } from '../../protoTypes/authorization.js';

describe('Authorization.getSubjectPermissions', () => {
  it('maps a missing resource definition to NOT_FOUND', async () => {
    const getSubjectPermissions = jest.fn(async () => {
      throw new GrpcError(status.NOT_FOUND, 'Resource definition not found');
    });
    const callback = jest.fn<GrpcResponse<{ permissions: unknown[] }>>();
    const call = {
      request: { subject: 'User:1', resource: 'Team:missing' },
    } as GrpcRequest<SubjectPermissionsRequest>;

    await Authorization.prototype.getSubjectPermissions.call(
      {
        permissionsController: { getSubjectPermissions },
      } as unknown as Authorization,
      call,
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      code: status.NOT_FOUND,
      message: 'Resource definition not found',
    });
  });

  it('hides unexpected failures behind a generic internal error', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const callback = jest.fn<GrpcResponse<{ permissions: unknown[] }>>();

    await Authorization.prototype.getSubjectPermissions.call(
      {
        permissionsController: {
          getSubjectPermissions: jest.fn(async () => {
            throw new Error('database exploded');
          }),
        },
      } as unknown as Authorization,
      {
        request: { subject: 'User:1', resource: 'Team:admin' },
      } as GrpcRequest<SubjectPermissionsRequest>,
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      code: status.INTERNAL,
      message: 'Could not list subject permissions',
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
