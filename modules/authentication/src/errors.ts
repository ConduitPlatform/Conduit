import { status } from '@grpc/grpc-js';
import { ModuleErrorDefinition } from '@conduitplatform/module-tools';

export const errors = {
  USER_EXISTS: {
    conduitCode: 'USER_EXISTS',
    grpcCode: status.ALREADY_EXISTS,
    message: 'User already exists',
    description: 'A user with this email already exists',
  },
  INVITATION_REQUIRED: {
    conduitCode: 'INVITATION_REQUIRED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Registration requires invitation',
    description: 'Registration is only allowed with an invitation',
  },
  INVALID_INVITATION: {
    conduitCode: 'INVALID_INVITATION',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Invalid invitation token',
    description: 'The provided invitation token is invalid',
  },
} as const satisfies Record<string, ModuleErrorDefinition>;
