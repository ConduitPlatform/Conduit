import { GrpcError, TYPE } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import type { DeclaredSchemaExtension } from '../../interfaces/DeclaredSchemaExtension.js';

export const EMBEDDINGS_MODULE_NAME = 'embeddings';

export interface EmbeddingsJobSchema {
  name: string;
  fields?: Record<string, unknown>;
  compiledFields?: Record<string, unknown>;
  extensions?: DeclaredSchemaExtension[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringLikeField(field: unknown): boolean {
  if (field === TYPE.String || field === 'String') return true;
  if (Array.isArray(field) && field.length === 1) return isStringLikeField(field[0]);
  if (!isRecord(field)) return false;
  if (field.type === TYPE.String || field.type === 'String') return true;
  return Array.isArray(field.type) && isStringLikeField(field.type);
}

function isVectorField(field: unknown): boolean {
  if (field === TYPE.Vector || field === 'Vector') return true;
  return isRecord(field) && (field.type === TYPE.Vector || field.type === 'Vector');
}

function schemaFields(schema: EmbeddingsJobSchema): Record<string, unknown> {
  return schema.compiledFields ?? schema.fields ?? {};
}

export function parseSelectFields(select?: string): string[] {
  if (!select) return [];
  return select
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.replace(/^[+-]/, ''));
}

export const EMBEDDINGS_JOB_DOCUMENT_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function isScalarDocumentId(value: unknown): value is string {
  return typeof value === 'string' && EMBEDDINGS_JOB_DOCUMENT_ID.test(value);
}

export function isIdOnlyQuery(query: unknown): boolean {
  let parsed = query;
  if (typeof query === 'string') {
    try {
      parsed = JSON.parse(query);
    } catch {
      return false;
    }
  }
  if (!isRecord(parsed)) return false;
  const keys = Object.keys(parsed);
  if (keys.length !== 1) return false;
  const key = keys[0];
  if (key !== '_id' && key !== 'id') return false;
  return isScalarDocumentId(parsed[key]);
}

export function assertEmbeddingsJobCaller(moduleName?: string): void {
  if (moduleName === EMBEDDINGS_MODULE_NAME) return;
  throw new GrpcError(
    status.PERMISSION_DENIED,
    'Embeddings job context is only available to the embeddings module',
  );
}

export function assertEmbeddingsJobRead(args: {
  query: unknown;
  select?: string;
  allowedFields?: string[];
  schema: EmbeddingsJobSchema;
}): void {
  if (!isIdOnlyQuery(args.query)) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Embeddings jobs may only read documents by id',
    );
  }
  const allowed = new Set(
    (args.allowedFields ?? []).filter(field => typeof field === 'string' && field.length),
  );
  if (!allowed.size) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Embeddings jobs require an explicit allowed field list',
    );
  }
  const fields = schemaFields(args.schema);
  for (const field of allowed) {
    if (field === '_id' || field === 'id') continue;
    if (!(field in fields)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        `Embeddings jobs cannot read unknown field '${field}'`,
      );
    }
    const definition = fields[field];
    const hashField = field.endsWith('SourceHash');
    if (!hashField && !isStringLikeField(definition)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        `Embeddings jobs cannot read non-string field '${field}'`,
      );
    }
  }
  const selected = parseSelectFields(args.select);
  if (!selected.length) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Embeddings jobs must select configured source and hash fields',
    );
  }
  for (const field of selected) {
    if (field === '_id' || field === 'id') continue;
    if (!allowed.has(field)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        `Embeddings jobs cannot select field '${field}'`,
      );
    }
  }
}

export function embeddingsOwnedWriteFields(schema: EmbeddingsJobSchema): Set<string> {
  const owned = new Set<string>();
  for (const extension of schema.extensions ?? []) {
    if (extension.ownerModule !== EMBEDDINGS_MODULE_NAME) continue;
    for (const [name, definition] of Object.entries(extension.fields ?? {})) {
      if (isVectorField(definition) || name.endsWith('SourceHash')) {
        owned.add(name);
      }
    }
  }
  return owned;
}

export function updateDocumentFields(document: unknown): string[] {
  let parsed = document;
  if (typeof document === 'string') {
    try {
      parsed = JSON.parse(document);
    } catch {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Embeddings job write is not valid JSON',
      );
    }
  }
  if (!isRecord(parsed)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Embeddings job writes must be objects');
  }
  if ('$set' in parsed) {
    const keys = Object.keys(parsed);
    if (keys.some(key => key !== '$set')) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Embeddings jobs may only use $set when sending update operators',
      );
    }
    if (!isRecord(parsed.$set)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Embeddings job $set must be an object',
      );
    }
    return Object.keys(parsed.$set);
  }
  if (Object.keys(parsed).some(key => key.startsWith('$'))) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Embeddings jobs cannot use update operators other than $set',
    );
  }
  return Object.keys(parsed);
}

export function assertEmbeddingsJobWrite(args: {
  document: unknown;
  schema: EmbeddingsJobSchema;
}): void {
  const owned = embeddingsOwnedWriteFields(args.schema);
  const fields = updateDocumentFields(args.document);
  if (!fields.length) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Embeddings job writes must include fields',
    );
  }
  for (const field of fields) {
    if (!owned.has(field)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        `Embeddings jobs cannot write field '${field}'`,
      );
    }
  }
}
