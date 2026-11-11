import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

export const errors = defineErrors({
  // Admin authentication (request level)
  ADMIN_MASTER_KEY_INVALID: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Unauthorized',
    description: 'The masterkey header is missing or incorrect',
  },
  ADMIN_TOKEN_MISSING: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'No token provided',
    description: 'The request has no Authorization header',
  },
  ADMIN_AUTH_HEADER_MALFORMED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Authorization header malformed',
    description: 'The Authorization header must have the form "Bearer <token>"',
  },
  ADMIN_TOKEN_INVALID: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Invalid token',
    description: 'The admin token is invalid or expired, log in again',
  },
  ADMIN_TOKEN_EXPIRED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Token has expired',
    description: 'The API token has expired, create a new one',
  },
  ADMIN_TOKEN_OWNER_NOT_FOUND: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'No such user exists',
    description: 'The admin that owns the token no longer exists',
  },
  REALTIME_TICKET_NOT_ALLOWED_ON_HTTP: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Realtime ticket cannot be used for HTTP requests',
    description: 'Realtime tickets are only valid for socket connections',
  },
  ADMIN_TWO_FA_REQUIRED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Two FA required',
    description: 'Two-factor verification is pending, complete it via verify-twofa',
  },
  ADMIN_AUTHENTICATION_REQUIRED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Authentication required',
    description: 'The request must be made by an authenticated admin',
  },

  // Admin login and two-factor authentication
  USERNAME_AND_PASSWORD_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Both username and password must be provided',
    description: 'Provide both a username and a password',
  },
  INVALID_ADMIN_CREDENTIALS: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Invalid username/password',
    description: 'The username or password is wrong',
  },
  ADMIN_TWO_FA_NOT_CONFIGURED: {
    grpcCode: status.NOT_FOUND,
    message: 'Verification unsuccessful',
    description: 'Two-factor authentication is not set up for this admin',
  },
  ADMIN_TWO_FA_CODE_INVALID: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Verification unsuccessful',
    description: 'The two-factor code is not valid, try again with a fresh code',
  },

  // Admin management
  ADMIN_USERNAME_TAKEN: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'Admin already exists',
    description: 'An admin with this username already exists, pick another username',
  },
  SUPER_ADMIN_REQUIRED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Only superAdmin can perform this action',
    description: 'This action is restricted to super admins',
  },
  ADMIN_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Admin not found',
    description: 'No admin matches the given id',
  },
  ADMIN_ID_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Id must be provided',
    description: 'Provide the id of the admin',
  },
  ADMIN_CANNOT_DELETE_SELF: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Admin cannot delete self',
    description: 'Admins cannot delete their own account, ask another super admin',
  },
  OLD_AND_NEW_PASSWORD_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Both old and new password must be provided',
    description: 'Provide both the old and the new password',
  },
  INCORRECT_PASSWORD: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Incorrect Password',
    description: 'The old password does not match the current one',
  },
  API_TOKEN_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Token not found',
    description: 'No API token with this id exists for the authenticated admin',
  },

  // Readiness
  CORE_NOT_READY: {
    grpcCode: status.UNAVAILABLE,
    message: 'Conduit Core is not ready',
    description: 'Core is not ready to serve requests yet, retry shortly',
  },

  // Admin routes and middlewares
  INVALID_ADMIN_ROUTE_ACTION: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid action',
    description: 'The action is not a valid route action',
  },
  ADMIN_ROUTE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Route not found',
    description: 'No admin route matches the given path and action',
  },
  ADMIN_MIDDLEWARE_PATCH_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to patch route middlewares',
    description: 'The middlewares of the admin route could not be updated',
  },
  ADMIN_ROUTE_REGISTRATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to register admin routes',
    description: 'The admin routes of the module could not be registered',
  },
  ADMIN_SOCKET_PUSH_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to push socket event',
    description: 'The socket event could not be pushed to admin clients',
  },

  // Configuration
  CONFIG_VALIDATION_FAILED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Configuration is invalid',
    description:
      'The submitted configuration failed validation, the message names the offending key',
  },
  CONFIG_UPDATE_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to update module configuration',
    description: 'The module configuration could not be updated',
  },
  MODULE_NOT_AVAILABLE: {
    grpcCode: status.UNAVAILABLE,
    message: 'Module is not available',
    description: 'The module is not running or not reachable, retry later',
  },
  MODULE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Module not found',
    description: 'No module with this name is registered',
  },
  SERVER_CONFIG_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Server config not found',
    description: 'The server configuration could not be read',
  },
  MODULE_CONFIG_NOT_SET: {
    grpcCode: status.NOT_FOUND,
    message: 'Config for module not set!',
    description: 'No configuration is stored for this module',
  },
  CONFIG_DELETE_FORBIDDEN: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Not authorized to delete module configuration',
    description: 'This module is not allowed to delete the given configuration',
  },
  CONFIG_DELETE_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to delete module configuration',
    description: 'The module configuration could not be deleted',
  },
  INVALID_MODULE_HEALTH_STATUS: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid module health status code value',
    description: 'The health status must be a valid status code between 0 and 2',
  },
});
