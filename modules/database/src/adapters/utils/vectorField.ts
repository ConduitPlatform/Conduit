import {
  TYPE,
  VectorIndexDefinition,
  VectorIndexMethod,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';

export type VectorIndexProvider = 'mongodb' | 'postgres';

export const SUPPORTED_VECTOR_INDEX_METHODS: Record<
  VectorIndexProvider,
  readonly VectorIndexMethod[]
> = {
  mongodb: [VectorIndexMethod.HNSW, VectorIndexMethod.Flat],
  postgres: [VectorIndexMethod.HNSW, VectorIndexMethod.IVFFlat],
};

export interface ParsedVectorField {
  type: TYPE.Vector;
  dimensions: number;
  similarity?: VectorSimilarity;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isVectorTypeName(value: unknown): value is TYPE.Vector {
  return value === TYPE.Vector || value === 'Vector';
}

export function isVectorShorthand(field: unknown): boolean {
  if (isVectorTypeName(field)) return true;
  return Array.isArray(field) && field.length === 1 && isVectorTypeName(field[0]);
}

export function isObjectFormVectorField(field: unknown): field is ParsedVectorField {
  return isPlainObject(field) && isVectorTypeName(field.type);
}

export function assertObjectFormVectorField(
  schemaName: string,
  fieldName: string,
  field: unknown,
): ParsedVectorField {
  if (isVectorShorthand(field)) {
    throw new ModuleError({
      ...errors.VECTOR_FIELD_INVALID,
      message:
        `Schema '${schemaName}' vector field '${fieldName}' must use object form ` +
        `'{ type: "Vector", dimensions, similarity }'. Shorthand 'Vector' is not allowed.`,
    });
  }
  if (!isObjectFormVectorField(field)) {
    throw new ModuleError({
      ...errors.VECTOR_FIELD_INVALID,
      message: `Schema '${schemaName}' field '${fieldName}' is not a Vector field.`,
    });
  }
  if (!Number.isInteger(field.dimensions) || field.dimensions <= 0) {
    throw new ModuleError({
      ...errors.VECTOR_DIMENSIONS_INVALID,
      message: `Schema '${schemaName}' vector field '${fieldName}' requires a positive integer 'dimensions' value.`,
    });
  }
  if (field.similarity !== undefined && !isSupportedVectorSimilarity(field.similarity)) {
    throw new ModuleError({
      ...errors.VECTOR_SIMILARITY_INVALID,
      message:
        `Schema '${schemaName}' vector field '${fieldName}' has unsupported similarity ` +
        `'${String(field.similarity)}'. Supported values: ${Object.values(VectorSimilarity).join(', ')}.`,
    });
  }
  return {
    type: TYPE.Vector,
    dimensions: field.dimensions,
    similarity: field.similarity,
  };
}

export function assertVectorFieldIfPresent(
  schemaName: string,
  fieldName: string,
  field: unknown,
): ParsedVectorField | undefined {
  if (isVectorShorthand(field) || isObjectFormVectorField(field)) {
    return assertObjectFormVectorField(schemaName, fieldName, field);
  }
  return undefined;
}

export function isSupportedVectorSimilarity(value: unknown): value is VectorSimilarity {
  return Object.values(VectorSimilarity).includes(value as VectorSimilarity);
}

export function parseVectorSimilarity(
  value: unknown,
  fallback: VectorSimilarity = VectorSimilarity.Cosine,
): VectorSimilarity {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (!isSupportedVectorSimilarity(value)) {
    throw new ModuleError({
      ...errors.VECTOR_SIMILARITY_INVALID,
      message: `Unsupported similarity '${String(value)}'. Supported values: ${Object.values(VectorSimilarity).join(', ')}.`,
    });
  }
  return value;
}

export function assertSafeVectorFieldChange(
  fieldName: string,
  oldField: unknown,
  newField: unknown,
): void {
  if (!isObjectFormVectorField(oldField) && !isVectorShorthand(oldField)) {
    return;
  }
  if (newField == null) return;
  const newType = isPlainObject(newField) ? newField.type : newField;
  if (!isVectorTypeName(newType) && !isObjectFormVectorField(newField)) {
    return;
  }
  if (isVectorShorthand(newField) || !isObjectFormVectorField(newField)) {
    throw new ModuleError({
      ...errors.SCHEMA_FIELD_CHANGE_FORBIDDEN,
      message: `Vector field '${fieldName}' must keep object form '{ type: "Vector", dimensions, similarity }'.`,
    });
  }
  if (!isObjectFormVectorField(oldField)) return;
  if (
    Number.isInteger(oldField.dimensions) &&
    Number.isInteger(newField.dimensions) &&
    oldField.dimensions !== newField.dimensions
  ) {
    throw new ModuleError({
      ...errors.SCHEMA_FIELD_CHANGE_FORBIDDEN,
      message: `Changing vector field '${fieldName}' dimensions from ${oldField.dimensions} to ${newField.dimensions} is not allowed.`,
    });
  }
}

export function assertSupportedVectorIndexMethod(
  provider: VectorIndexProvider,
  method?: string,
): void {
  if (method === undefined || method === '') return;
  const supported = SUPPORTED_VECTOR_INDEX_METHODS[provider];
  if (!supported.includes(method as VectorIndexMethod)) {
    throw new ModuleError({
      ...errors.VECTOR_INDEX_INVALID,
      message:
        `Unsupported vector index method '${method}' for ${provider}. ` +
        `Supported methods: ${supported.join(', ')}.`,
    });
  }
}

export function assertVectorIndexMatchesField(
  field: unknown,
  index: VectorIndexDefinition,
): void {
  if (!isObjectFormVectorField(field)) {
    throw new ModuleError({
      ...errors.VECTOR_FIELD_INVALID,
      message: 'Vector index field is not a vector',
    });
  }
  if (field.dimensions !== index.dimensions) {
    throw new ModuleError({
      ...errors.VECTOR_DIMENSIONS_INVALID,
      message: `Vector index dimensions mismatch: field ${field.dimensions}, index ${index.dimensions}`,
    });
  }
  if (
    index.similarity !== undefined &&
    field.similarity !== undefined &&
    field.similarity !== index.similarity
  ) {
    throw new ModuleError({
      ...errors.VECTOR_SIMILARITY_INVALID,
      message: `Vector index similarity mismatch: field ${field.similarity}, index ${index.similarity}`,
    });
  }
}

export function assertVectorIndexContract(
  provider: VectorIndexProvider,
  index: VectorIndexDefinition,
): void {
  if (!index.field || typeof index.field !== 'string') {
    throw new ModuleError({
      ...errors.VECTOR_INDEX_INVALID,
      message: 'Vector index field is required',
    });
  }
  if (!Number.isInteger(index.dimensions) || index.dimensions <= 0) {
    throw new ModuleError({
      ...errors.VECTOR_DIMENSIONS_INVALID,
      message: 'Vector index dimensions must be a positive integer',
    });
  }
  if (!isSupportedVectorSimilarity(index.similarity)) {
    throw new ModuleError({
      ...errors.VECTOR_SIMILARITY_INVALID,
      message:
        `Unsupported vector index similarity '${String(index.similarity)}'. ` +
        `Supported values: ${Object.values(VectorSimilarity).join(', ')}.`,
    });
  }
  assertSupportedVectorIndexMethod(provider, index.method);
}
