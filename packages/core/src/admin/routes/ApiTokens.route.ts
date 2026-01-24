import crypto from 'crypto';
import { AdminApiToken } from '../../models/index.js';
import { hashPassword } from '../utils/auth.js';
import { ConduitRoute } from '@conduitplatform/hermes';
import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitString, ConduitNumber, ConduitDate } from '@conduitplatform/module-tools';

/**
 * Generates a cryptographically secure random token.
 * @param bytes Number of random bytes (default 32)
 * @returns Base64url encoded random string
 */
function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * POST /api-tokens
 * Creates a new API token for the authenticated admin.
 * The plaintext token is only returned once during creation.
 */
export function createApiTokenRoute() {
  return new ConduitRoute(
    {
      path: '/api-tokens',
      action: ConduitRouteActions.POST,
      description:
        'Create a new API token for the authenticated admin. The token is only shown once and cannot be retrieved later.',
      bodyParams: {
        name: ConduitString.Required,
        expiresInDays: ConduitNumber.Optional,
      },
    },
    new ConduitRouteReturnDefinition('CreateApiToken', {
      id: ConduitString.Required,
      name: ConduitString.Required,
      token: ConduitString.Required,
      expiresAt: ConduitDate.Optional,
      createdAt: ConduitDate.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const admin = req.context!.admin;
      const { name, expiresInDays } = req.params!;

      // Generate token: cdt_<random-base64url>
      const rawToken = `cdt_${generateRandomToken(32)}`;
      const hashedToken = await hashPassword(rawToken);
      const tokenPrefix = rawToken.substring(0, 12); // "cdt_xxxxxxxx"

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const apiToken = await AdminApiToken.getInstance().create({
        name,
        adminId: admin._id,
        hashedToken,
        tokenPrefix,
        expiresAt,
      });

      return {
        id: apiToken._id,
        name: apiToken.name,
        token: rawToken, // Only returned on creation!
        expiresAt: apiToken.expiresAt,
        createdAt: apiToken.createdAt,
      };
    },
  );
}

/**
 * GET /api-tokens
 * Lists all API tokens for the authenticated admin.
 * Token values are not returned - only metadata.
 */
export function getApiTokensRoute() {
  return new ConduitRoute(
    {
      path: '/api-tokens',
      action: ConduitRouteActions.GET,
      description:
        'List all API tokens for the authenticated admin. Token values are not returned.',
    },
    new ConduitRouteReturnDefinition('GetApiTokens', {
      tokens: [
        {
          _id: ConduitString.Required,
          name: ConduitString.Required,
          tokenPrefix: ConduitString.Required,
          expiresAt: ConduitDate.Optional,
          lastUsedAt: ConduitDate.Optional,
          createdAt: ConduitDate.Required,
        },
      ],
    }),
    async (req: ConduitRouteParameters) => {
      const admin = req.context!.admin;
      const tokens = await AdminApiToken.getInstance().findMany(
        { adminId: admin._id },
        '_id name tokenPrefix expiresAt lastUsedAt createdAt',
      );
      return { tokens };
    },
  );
}

/**
 * DELETE /api-tokens/:id
 * Revokes (deletes) an API token.
 * Admins can only revoke their own tokens.
 */
export function deleteApiTokenRoute() {
  return new ConduitRoute(
    {
      path: '/api-tokens/:id',
      action: ConduitRouteActions.DELETE,
      description: 'Revoke an API token. Admins can only revoke their own tokens.',
      urlParams: {
        id: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('DeleteApiToken', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const admin = req.context!.admin;
      const { id } = req.params!;

      const deleted = await AdminApiToken.getInstance().deleteOne({
        _id: id,
        adminId: admin._id, // Ensure admin can only delete their own tokens
      });

      if (!deleted.deletedCount) {
        throw new ConduitError('NOT_FOUND', 404, 'Token not found');
      }

      return { message: 'Token revoked successfully' };
    },
  );
}
