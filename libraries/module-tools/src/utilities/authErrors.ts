import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

/**
 * Errors of request authentication. They are shared so that a client sees the same
 * `conduitCode` whether its token was checked by the router (JWT mode) or by the
 * authentication module (session mode).
 *
 * Rule of thumb for client SDKs: TOKEN_EXPIRED means refresh; the other TOKEN_* codes,
 * SESSION_REVOKED and AUTH_USER_NOT_FOUND mean sign in again; TWO_FA_REQUIRED means
 * finish the second factor; the UNAVAILABLE ones mean retry later.
 */
export const authErrors = defineErrors({
  AUTH_TOKEN_MISSING: {
    grpcCode: status.UNAUTHENTICATED,
    message: "No 'Authorization' header or 'accessToken' cookie present",
    description: 'The request carries neither a bearer token nor an access token cookie',
  },
  AUTH_HEADER_MALFORMED: {
    grpcCode: status.UNAUTHENTICATED,
    message: "'Authorization' header malformed",
    description: 'The Authorization header must be exactly "Bearer <token>"',
  },
  TOKEN_MALFORMED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Token is malformed',
    description: 'The access token cannot be decoded or uses an unsupported algorithm',
  },
  TOKEN_INVALID: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Token is invalid',
    description:
      'The access token is unknown, or its signature does not match a current signing key',
  },
  TOKEN_EXPIRED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Token has expired',
    description: 'The access token has expired; use the refresh token to get a new one',
  },
  TOKEN_REVOKED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Token has been revoked',
    description: 'All tokens issued before a server-side revocation are rejected',
  },
  TOKEN_CLIENT_MISMATCH: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Token was issued for a different client',
    description: 'The access token belongs to another security client',
  },
  SESSION_REVOKED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Session revoked',
    description: 'The session of this token was ended (logout or revocation)',
  },
  TWO_FA_REQUIRED: {
    grpcCode: status.UNAUTHENTICATED,
    message: '2FA is required',
    description:
      'The token is valid but two-factor authentication has not been completed yet',
  },
  CLIENT_ID_MISSING: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Client id missing',
    description: 'No security client was identified for the request',
  },
  AUTH_USER_NOT_FOUND: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Unauthorized',
    description: 'The user of this token no longer exists',
  },
  USER_BLOCKED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'User is blocked or deleted',
    description: 'The account of this token is blocked or was deleted',
  },
  AUTH_VERIFIER_NOT_READY: {
    // Fails closed as UNAUTHENTICATED, like every other token rejection.
    grpcCode: status.UNAUTHENTICATED,
    message: 'Authentication is not ready',
    description: 'Signing keys have not been loaded yet; retry shortly',
  },
  SESSION_REGISTRY_UNAVAILABLE: {
    grpcCode: status.UNAVAILABLE,
    message: 'Session registry unavailable',
    description: 'The session could not be checked; retry shortly',
  },
  USER_LOOKUP_UNAVAILABLE: {
    grpcCode: status.UNAVAILABLE,
    message: 'User lookup unavailable',
    description: 'The authentication service is not reachable; retry shortly',
  },
  USER_LOOKUP_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'User lookup failed',
    description: 'The user of this token could not be loaded',
  },
});
