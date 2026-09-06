import {
  TYPE,
  VectorIndexDefinition,
  VectorIndexMethod,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { isObjectFormVectorField } from './vectorField.js';

export type VectorStorageBackend = 'mongodb' | 'postgres' | 'sql';

export type VectorFieldStorageMapping =
  | {
      backend: 'mongodb';
      storage: 'numberArray';
      dimensions: number;
      searchSupported: true;
    }
  | {
      backend: 'postgres';
      storage: 'pgvector';
      dimensions: number;
      searchSupported: true;
    }
  | {
      backend: 'sql';
      storage: 'json';
      dimensions: number;
      searchSupported: false;
    };

export function mongoVectorStorageType() {
  return [Number];
}

export function vectorFieldStorageMapping(
  backend: VectorStorageBackend,
  field: { dimensions: number },
): VectorFieldStorageMapping {
  switch (backend) {
    case 'mongodb':
      return {
        backend: 'mongodb',
        storage: 'numberArray',
        dimensions: field.dimensions,
        searchSupported: true,
      };
    case 'postgres':
      return {
        backend: 'postgres',
        storage: 'pgvector',
        dimensions: field.dimensions,
        searchSupported: true,
      };
    case 'sql':
      return {
        backend: 'sql',
        storage: 'json',
        dimensions: field.dimensions,
        searchSupported: false,
      };
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unsupported vector storage backend: ${String(exhaustive)}`);
    }
  }
}

export function applyMongoVectorField<T extends Record<string, unknown>>(field: T): T {
  return {
    ...field,
    type: mongoVectorStorageType(),
  };
}

export function pgVectorOperator(similarity: string) {
  if (similarity === VectorSimilarity.Euclidean || similarity === 'euclidean') {
    return 'vector_l2_ops';
  }
  if (similarity === VectorSimilarity.DotProduct || similarity === 'dotProduct') {
    return 'vector_ip_ops';
  }
  return 'vector_cosine_ops';
}

export function pgVectorDistanceOperator(similarity: string) {
  if (similarity === VectorSimilarity.Euclidean || similarity === 'euclidean') {
    return '<->';
  }
  if (similarity === VectorSimilarity.DotProduct || similarity === 'dotProduct') {
    return '<#>';
  }
  return '<=>';
}

export function toMongoVectorIndexDefinition(index: VectorIndexDefinition) {
  const vectorField: Record<string, unknown> = {
    type: 'vector',
    path: index.field,
    numDimensions: index.dimensions,
    similarity: index.similarity,
  };
  if (index.options?.quantization) {
    vectorField.quantization = index.options.quantization;
  }
  if (index.method) {
    vectorField.indexingMethod = index.method;
  }
  if (index.options?.hnsw) {
    vectorField.hnswOptions = {
      ...(index.options.hnsw.maxEdges && { maxEdges: index.options.hnsw.maxEdges }),
      ...(index.options.hnsw.numEdgeCandidates && {
        numEdgeCandidates: index.options.hnsw.numEdgeCandidates,
      }),
    };
  }
  return {
    fields: [
      vectorField,
      ...(index.filterFields ?? []).map((path: string) => ({ type: 'filter', path })),
    ],
    ...(index.options?.storedSource !== undefined && {
      storedSource: index.options.storedSource,
    }),
  };
}

export function fromMongoVectorIndex(index: {
  name?: string;
  latestDefinition?: { fields?: Array<Record<string, any>> };
  definition?: { fields?: Array<Record<string, any>> };
}): VectorIndexDefinition {
  const fields = index.latestDefinition?.fields ?? index.definition?.fields ?? [];
  const vectorField = fields.find(field => field.type === 'vector') ?? {};
  return {
    name: index.name,
    field: vectorField.path,
    dimensions: vectorField.numDimensions,
    similarity: vectorField.similarity,
    method: vectorField.indexingMethod,
    filterFields: fields
      .filter(field => field.type === 'filter')
      .map(field => field.path),
  };
}

export function fromPostgresVectorIndex(
  name: string,
  definition: string,
  field?: { dimensions?: number; similarity?: VectorSimilarity },
): VectorIndexDefinition {
  const method = /USING\s+(\w+)/i.exec(definition)?.[1];
  const fieldMatch = /\((?:"([^"]+)"|(\w+))\s+vector_/i.exec(definition);
  const operator = /vector_(l2|cosine|ip)_ops/i.exec(definition)?.[1];
  const similarity =
    field?.similarity ??
    (operator === 'l2'
      ? VectorSimilarity.Euclidean
      : operator === 'ip'
        ? VectorSimilarity.DotProduct
        : VectorSimilarity.Cosine);
  return {
    name,
    field: fieldMatch?.[1] ?? fieldMatch?.[2] ?? '',
    dimensions: field?.dimensions ?? 0,
    similarity,
    method: method as VectorIndexMethod | undefined,
  };
}

export function postgresIndexMethodSql(method?: VectorIndexMethod | string) {
  return method === VectorIndexMethod.IVFFlat || method === 'ivfflat'
    ? 'ivfflat'
    : 'hnsw';
}

export function resolveVectorFieldFromSchema(
  schemaFields: Record<string, unknown> | undefined,
  fieldName: string,
) {
  const field = schemaFields?.[fieldName];
  if (!isObjectFormVectorField(field)) return undefined;
  return field;
}

export function isVectorSchemaType(type: unknown) {
  return type === TYPE.Vector || type === 'Vector';
}
