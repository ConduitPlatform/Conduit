import { status } from '@grpc/grpc-js';
import { ModuleErrorDefinition } from '@conduitplatform/grpc-sdk';

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
  EMAIL_NOT_ALLOWED: {
    conduitCode: 'EMAIL_NOT_ALLOWED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'This email address is not allowed',
    description: 'The provided email address is blocked by email restrictions',
  },
  REGISTRATION_NOT_ALLOWED: {
    conduitCode: 'REGISTRATION_NOT_ALLOWED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'User registration is not allowed for this request',
    description:
      'OAuth was started in sign-in-only mode and no existing user was found. Invitation tokens still allow registration.',
  },
  REALM_NOT_FOUND: {
    conduitCode: 'REALM_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'Realm not found',
    description: 'The requested realm does not exist or is not active',
  },
  REALM_SLUG_TAKEN: {
    conduitCode: 'REALM_SLUG_TAKEN',
    grpcCode: status.ALREADY_EXISTS,
    message: 'Realm slug is already in use',
    description: 'Another realm already uses this slug',
  },
  REALM_HAS_HOME_USERS: {
    conduitCode: 'REALM_HAS_HOME_USERS',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Realm still has home users',
    description:
      'The realm cannot be demoted or deleted while it has home users, unless forced',
  },
  REALM_NESTED: {
    conduitCode: 'REALM_NESTED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Realms cannot be nested',
    description:
      'A realm must be a top-level team and cannot contain or sit inside another realm',
  },
  GUESTS_NOT_ALLOWED: {
    conduitCode: 'GUESTS_NOT_ALLOWED',
    grpcCode: status.PERMISSION_DENIED,
    message: "This realm does not allow guests from this user's home realm",
    description: 'The realm guest policy rejects the user',
  },
  LINK_CONFLICT: {
    conduitCode: 'LINK_CONFLICT',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'The account conflicts with an account of this realm',
    description:
      'The realm already has a home account or a linked guest holding one of the identifiers (email, phone, username, wallet or provider id) of the account. Each realm has at most one principal per identifier.',
  },
  HOME_USER_REMOVAL: {
    conduitCode: 'HOME_USER_REMOVAL',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Home users cannot be removed from their home realm',
    description: 'Block, delete or move the user to another home realm instead',
  },
  REALMS_DISABLED: {
    conduitCode: 'REALMS_DISABLED',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Realms are disabled',
    description: 'The teams.realms.enabled configuration flag is off',
  },
  REALM_ACCESS_DENIED: {
    conduitCode: 'REALM_ACCESS_DENIED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Access to this realm is denied',
    description:
      'The user is not allowed to enter this realm or does not satisfy its policies',
  },
  TWO_FA_REQUIRED_FOR_REALM: {
    conduitCode: 'TWO_FA_REQUIRED_FOR_REALM',
    grpcCode: status.PERMISSION_DENIED,
    message: 'This realm requires two-factor authentication',
    description:
      'The user must enable and pass two-factor authentication to enter this realm',
  },
  STRATEGY_NOT_AVAILABLE_FOR_REALM: {
    conduitCode: 'STRATEGY_NOT_AVAILABLE_FOR_REALM',
    grpcCode: status.PERMISSION_DENIED,
    message: 'This authentication strategy is not available for this realm',
    description: 'The realm has not enabled the requested authentication strategy',
  },
} as const satisfies Record<string, ModuleErrorDefinition>;
