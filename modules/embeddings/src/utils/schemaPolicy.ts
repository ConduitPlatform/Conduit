import { GrpcError, TYPE } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { BACKFILL_RUN_SCHEMA } from './backfillRun.js';

export const EMBEDDING_CONFIG_SCHEMA = 'EmbeddingConfig';
export { BACKFILL_RUN_SCHEMA };
export const EMBEDDINGS_OWNER_MODULE = 'embeddings';
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

export const DATABASE_SYSTEM_SCHEMA_NAMES = new Set([
  '_DeclaredSchema',
  'MigratedSchemas',
  'CustomEndpoints',
  '_PendingSchemas',
  'Views',
]);

export const PLATFORM_INTERNAL_SCHEMA_NAMES = new Set([
  'Admin',
  'AdminMiddleware',
  'AdminApiToken',
  'AdminTwoFactorSecret',
  'Config',
  'Client',
  'AppMiddleware',
  'ResourceDefinition',
  'Relationship',
  'ObjectIndex',
  'Permission',
  'ActorIndex',
]);

export const INTERNAL_OWNER_MODULES = new Set(['core', 'router', 'authorization']);

export const SYSTEM_SCHEMA_NAMES = new Set([
  ...DATABASE_SYSTEM_SCHEMA_NAMES,
  ...PLATFORM_INTERNAL_SCHEMA_NAMES,
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

/**
 * Explicit denylist for embeddings sources. Platform internals (Database system
 * schemas, core/router/authorization) are denied even when extendable.
 * Owner-controlled business schemas (including authentication User/Team) are
 * not denied by ownerModule alone.
 */
export function isDeniedEmbeddingSchema(schema: {
  name: string;
  ownerModule?: string;
}): boolean {
  if (!schema.name) return true;
  if (schema.ownerModule === EMBEDDINGS_OWNER_MODULE) return true;
  if (EMBEDDING_OWNED_SCHEMA_NAMES.has(schema.name)) return true;
  if (schema.name.startsWith('_')) return true;
  if (SYSTEM_SCHEMA_NAMES.has(schema.name)) return true;
  if (schema.ownerModule && INTERNAL_OWNER_MODULES.has(schema.ownerModule)) return true;
  return AUTH_SECRET_SCHEMA_NAMES.has(schema.name);
}

export function embeddingSourceHashField(targetField: string): string {
  return `${targetField}SourceHash`;
}

export interface EmbeddingSchemaOptions {
  conduit?: {
    cms?: { enabled?: boolean };
    permissions?: { extendable?: boolean };
    authorization?: { enabled?: boolean };
  };
}

export function isCmsEnabled(modelOptions?: EmbeddingSchemaOptions): boolean {
  return modelOptions?.conduit?.cms?.enabled === true;
}

export function isSchemaExtendable(modelOptions?: EmbeddingSchemaOptions): boolean {
  return modelOptions?.conduit?.permissions?.extendable === true;
}

export function isEmbeddingSchemaEnabled(modelOptions?: EmbeddingSchemaOptions): boolean {
  if (modelOptions?.conduit?.cms == null) return true;
  return isCmsEnabled(modelOptions);
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

export function assertSchemaCanReceiveEmbeddings(schema: {
  name: string;
  ownerModule?: string;
  modelOptions?: EmbeddingSchemaOptions;
}): void {
  assertEmbeddingTargetSchema(schema);
  if (!isEmbeddingSchemaEnabled(schema.modelOptions)) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `Schema '${schema.name}' is not enabled`,
    );
  }
  if (!isSchemaExtendable(schema.modelOptions)) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `Schema '${schema.name}' is not extendable`,
    );
  }
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

export function normalizeSourceFieldAllowlist(fields?: string[]): string[] {
  return [
    ...new Set(
      (fields ?? []).filter(field => typeof field === 'string' && field.length > 0),
    ),
  ];
}

export function resolveSourceFieldAllowlist(args: {
  operatorAllowlist?: string[];
  requestAllowlist?: string[];
  platformAdmin?: boolean;
}): string[] {
  const operatorAllowlist = normalizeSourceFieldAllowlist(args.operatorAllowlist);
  if (!args.platformAdmin) return operatorAllowlist;
  return [
    ...new Set([
      ...operatorAllowlist,
      ...normalizeSourceFieldAllowlist(args.requestAllowlist),
    ]),
  ];
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

export interface SchemaExtensionInfo {
  ownerModule: string;
  fields: Record<string, unknown>;
}

export interface EmbeddingExtensionField {
  type: string;
  dimensions?: number;
  similarity?: string;
  required?: boolean;
  select?: boolean;
}

export function assertEmbeddingExtensionAvailability(args: {
  schemaName: string;
  targetField: string;
  dimensions: number;
  similarity: string;
  baseFields?: Record<string, unknown>;
  compiledFields: Record<string, unknown>;
  extensions?: SchemaExtensionInfo[];
}): void {
  const hashField = embeddingSourceHashField(args.targetField);
  const proposed: Record<string, EmbeddingExtensionField> = {
    [args.targetField]: {
      type: TYPE.Vector,
      dimensions: args.dimensions,
      similarity: args.similarity,
      select: false,
    },
    [hashField]: {
      type: TYPE.String,
      required: false,
      select: false,
    },
  };
  for (const [name, definition] of Object.entries(proposed)) {
    assertExtensionFieldAvailable({
      schemaName: args.schemaName,
      fieldName: name,
      proposed: definition,
      baseFields: args.baseFields,
      compiledFields: args.compiledFields,
      extensions: args.extensions ?? [],
    });
  }
}

function fieldOwner(
  fieldName: string,
  extensions: SchemaExtensionInfo[],
): SchemaExtensionInfo | undefined {
  return extensions.find(extension => fieldName in (extension.fields ?? {}));
}

function assertExtensionFieldAvailable(args: {
  schemaName: string;
  fieldName: string;
  proposed: EmbeddingExtensionField;
  baseFields?: Record<string, unknown>;
  compiledFields: Record<string, unknown>;
  extensions: SchemaExtensionInfo[];
}): void {
  const owned = fieldOwner(args.fieldName, args.extensions);
  if (owned && owned.ownerModule !== EMBEDDINGS_OWNER_MODULE) {
    throw extensionCollision(args.schemaName, args.fieldName);
  }
  if (owned?.ownerModule === EMBEDDINGS_OWNER_MODULE) {
    if (!isCompatibleEmbeddingField(owned.fields[args.fieldName], args.proposed)) {
      throw extensionCollision(args.schemaName, args.fieldName);
    }
    return;
  }
  if (args.baseFields && args.fieldName in args.baseFields) {
    throw extensionCollision(args.schemaName, args.fieldName);
  }
  if (args.fieldName in args.compiledFields) {
    if (!isCompatibleEmbeddingField(args.compiledFields[args.fieldName], args.proposed)) {
      throw extensionCollision(args.schemaName, args.fieldName);
    }
  }
}

function extensionCollision(schemaName: string, fieldName: string): GrpcError {
  return new GrpcError(
    status.ALREADY_EXISTS,
    `Field '${fieldName}' already exists on schema '${schemaName}' and is not a compatible embeddings extension`,
  );
}

function fieldType(field: unknown): string | undefined {
  if (typeof field === 'string') return field;
  if (!isRecord(field)) return undefined;
  if (typeof field.type === 'string') return field.type;
  return undefined;
}

function isCompatibleEmbeddingField(
  existing: unknown,
  proposed: EmbeddingExtensionField,
): boolean {
  const type = fieldType(existing);
  if (type !== proposed.type) return false;
  if (proposed.type === TYPE.Vector) {
    if (!isRecord(existing)) return false;
    if (existing.dimensions !== proposed.dimensions) return false;
    if (
      typeof existing.similarity === 'string' &&
      existing.similarity !== proposed.similarity
    ) {
      return false;
    }
    return true;
  }
  if (proposed.type === TYPE.String) {
    if (isRecord(existing) && existing.required === true) return false;
    return isStringLikeField(existing);
  }
  return false;
}
