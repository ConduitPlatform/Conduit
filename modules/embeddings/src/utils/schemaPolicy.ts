import { TYPE } from '@conduitplatform/grpc-sdk';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { BACKFILL_RUN_SCHEMA } from './backfillRun.js';

export const EMBEDDING_CONFIG_SCHEMA = 'EmbeddingConfig';
export { BACKFILL_RUN_SCHEMA };
export const EMBEDDING_OWNED_SCHEMA_NAMES = new Set([
  EMBEDDING_CONFIG_SCHEMA,
  BACKFILL_RUN_SCHEMA,
]);
export const CONFIG_OPERATOR_MODULES = ['database', 'core'] as const;
export const SEARCH_OPERATOR_MODULES = ['database', 'core', 'embeddings'] as const;

export const AUTH_SECRET_SCHEMA_NAMES = new Set([
  'AccessToken',
  'RefreshToken',
  'Token',
  'TwoFactorSecret',
  'TwoFactorBackUpCodes',
  'BiometricToken',
  'AdminTwoFactorSecret',
  'AdminApiToken',
]);

export const SYSTEM_SCHEMA_NAMES = new Set([
  'Views',
  'Config',
  'MigratedSchemas',
  'PendingSchemas',
  'CustomEndpoints',
]);

const SENSITIVE_FIELD_NAME =
  /(password|secret|token|credential|apikey|api_key|private[_-]?key|authorization|refresh[_-]?token|access[_-]?token)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSensitiveFieldName(field: string): boolean {
  return SENSITIVE_FIELD_NAME.test(field);
}

export function isStringLikeField(field: unknown): boolean {
  if (field === TYPE.String || field === 'String') return true;
  if (Array.isArray(field) && field.length === 1) return isStringLikeField(field[0]);
  if (!isRecord(field)) return false;
  if (field.type === TYPE.String || field.type === 'String') return true;
  return Array.isArray(field.type) && isStringLikeField(field.type);
}

export function isHiddenField(field: unknown): boolean {
  return isRecord(field) && field.select === false;
}

export function isDeniedEmbeddingSchema(schema: {
  name: string;
  ownerModule?: string;
}): boolean {
  if (!schema.name) return true;
  if (EMBEDDING_OWNED_SCHEMA_NAMES.has(schema.name)) return true;
  if (schema.name.startsWith('_')) return true;
  if (SYSTEM_SCHEMA_NAMES.has(schema.name)) return true;
  return AUTH_SECRET_SCHEMA_NAMES.has(schema.name);
}

export function assertEmbeddingTargetSchema(schema: {
  name: string;
  ownerModule?: string;
}): void {
  if (!isDeniedEmbeddingSchema(schema)) return;
  throw new GrpcError(
    status.PERMISSION_DENIED,
    `Schema '${schema.name}' cannot be used as an embedding source`,
  );
}

export function canManageEmbeddingConfig(args: {
  callerModule?: string;
  ownerModule?: string;
  operatorModules?: readonly string[];
}): boolean {
  if (!args.callerModule) return false;
  if (args.ownerModule && args.callerModule === args.ownerModule) return true;
  const operators = args.operatorModules ?? CONFIG_OPERATOR_MODULES;
  return operators.includes(args.callerModule);
}

export function assertCanManageEmbeddingConfig(args: {
  callerModule?: string;
  ownerModule?: string;
  schemaName: string;
}): void {
  if (canManageEmbeddingConfig(args)) return;
  throw new GrpcError(
    status.PERMISSION_DENIED,
    `Module '${args.callerModule ?? 'unknown'}' is not allowed to manage embeddings for '${args.schemaName}'`,
  );
}

export function resolveAdminOperatorContext(args: {
  requested?: boolean;
  callerModule?: string;
  operatorModules?: readonly string[];
}): boolean {
  if (!args.requested) return false;
  const operators = args.operatorModules ?? SEARCH_OPERATOR_MODULES;
  if (!args.callerModule || !operators.includes(args.callerModule)) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Admin operator context is not allowed for this caller',
    );
  }
  return true;
}

export function assertSemanticSearchAccess(args: {
  userId?: string;
  scope?: string;
  adminOperator?: boolean;
}): void {
  if (args.userId || args.scope || args.adminOperator) return;
  throw new GrpcError(
    status.PERMISSION_DENIED,
    'Semantic search requires a subject, scope, or admin operator context',
  );
}

export function assertSourceFields(args: {
  sourceFields: string[];
  schemaFields: Record<string, unknown>;
  allowlist?: string[];
}): void {
  const allowlist = new Set(args.allowlist ?? []);
  for (const field of args.sourceFields) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Invalid source field name '${field}'`,
      );
    }
    const definition = args.schemaFields[field];
    if (definition === undefined) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Source field '${field}' does not exist on the target schema`,
      );
    }
    if (!isStringLikeField(definition)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Source field '${field}' must be string-like`,
      );
    }
    const allowed = allowlist.has(field);
    if (!allowed && isHiddenField(definition)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Source field '${field}' is hidden and cannot be embedded`,
      );
    }
    if (!allowed && isSensitiveFieldName(field)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Source field '${field}' looks sensitive and cannot be embedded`,
      );
    }
  }
}
