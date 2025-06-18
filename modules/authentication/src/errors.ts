import { status } from '@grpc/grpc-js';

export const errors = {
  USER_EXISTS: {
    conduitCode: 'USER_EXISTS',
    grpcCode: status.ALREADY_EXISTS,
    message: 'User already exists',
    description: 'A user with this email already exists',
  },
};
