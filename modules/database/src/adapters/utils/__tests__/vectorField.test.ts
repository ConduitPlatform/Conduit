import { describe, expect, it } from '@jest/globals';
import {
  ConduitError,
  GrpcError,
  TYPE,
  VectorIndexMethod,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertObjectFormVectorField,
  assertSafeVectorFieldChange,
  assertSupportedVectorIndexMethod,
  assertVectorFieldIfPresent,
  assertVectorIndexContract,
  assertVectorIndexMatchesField,
  isVectorShorthand,
  parseVectorSimilarity,
  SUPPORTED_VECTOR_INDEX_METHODS,
} from '../vectorField.js';
import { fieldsValidator, validateFieldChanges } from '../index.js';
import { ConduitDatabaseSchema } from '../../../interfaces/index.js';

describe('vector field contracts', () => {
  const validField = {
    type: TYPE.Vector,
    dimensions: 1536,
    similarity: VectorSimilarity.Cosine,
  };

  it('rejects shorthand Vector definitions', () => {
    expect(isVectorShorthand(TYPE.Vector)).toBe(true);
    expect(isVectorShorthand('Vector')).toBe(true);
    expect(isVectorShorthand(['Vector'])).toBe(true);
    expect(() => assertVectorFieldIfPresent('Docs', 'embedding', 'Vector')).toThrow(
      ConduitError,
    );
    expect(() => fieldsValidator('Docs', { embedding: 'Vector' }, 'mongodb')).toThrow(
      /object form/,
    );
  });

  it('requires a positive integer dimensions value', () => {
    expect(() =>
      assertObjectFormVectorField('Docs', 'embedding', {
        type: TYPE.Vector,
        dimensions: 0,
      }),
    ).toThrow(/positive integer/);
    expect(() =>
      assertObjectFormVectorField('Docs', 'embedding', {
        type: TYPE.Vector,
        dimensions: 1.5,
      }),
    ).toThrow(/positive integer/);
    expect(() =>
      assertObjectFormVectorField('Docs', 'embedding', {
        type: TYPE.Vector,
        dimensions: -8,
      }),
    ).toThrow(/positive integer/);
  });

  it('rejects unsupported similarity values and accepts the enum', () => {
    expect(() =>
      assertObjectFormVectorField('Docs', 'embedding', {
        type: TYPE.Vector,
        dimensions: 8,
        similarity: 'manhattan',
      }),
    ).toThrow(/unsupported similarity/i);
    expect(assertObjectFormVectorField('Docs', 'embedding', validField)).toEqual(
      validField,
    );
    expect(parseVectorSimilarity(undefined)).toBe(VectorSimilarity.Cosine);
    expect(parseVectorSimilarity(VectorSimilarity.DotProduct)).toBe(
      VectorSimilarity.DotProduct,
    );
  });

  it('rejects unsafe in-place dimension changes and allows same-dimension updates', () => {
    expect(() =>
      assertSafeVectorFieldChange('embedding', validField, {
        ...validField,
        dimensions: 768,
      }),
    ).toThrow(/dimensions/);
    expect(() =>
      assertSafeVectorFieldChange('embedding', validField, {
        ...validField,
        similarity: VectorSimilarity.Euclidean,
      }),
    ).not.toThrow();

    const oldSchema = {
      compiledFields: { embedding: validField, title: TYPE.String },
    } as unknown as ConduitDatabaseSchema;
    const newSchema = {
      compiledFields: {
        embedding: { ...validField, dimensions: 3072 },
        title: TYPE.String,
      },
    } as unknown as ConduitDatabaseSchema;
    expect(() => validateFieldChanges(oldSchema, newSchema)).toThrow(ConduitError);
  });

  it('validates provider-specific index methods', () => {
    expect(SUPPORTED_VECTOR_INDEX_METHODS.mongodb).toEqual([
      VectorIndexMethod.HNSW,
      VectorIndexMethod.Flat,
    ]);
    expect(SUPPORTED_VECTOR_INDEX_METHODS.postgres).toEqual([
      VectorIndexMethod.HNSW,
      VectorIndexMethod.IVFFlat,
    ]);
    expect(() =>
      assertSupportedVectorIndexMethod('mongodb', VectorIndexMethod.IVFFlat),
    ).toThrow(GrpcError);
    expect(() =>
      assertSupportedVectorIndexMethod('postgres', VectorIndexMethod.Flat),
    ).toThrow(GrpcError);
    expect(() =>
      assertSupportedVectorIndexMethod('postgres', VectorIndexMethod.HNSW),
    ).not.toThrow();
  });

  it('rejects index contracts that do not match the schema field', () => {
    expect(() =>
      assertVectorIndexMatchesField(
        { type: TYPE.String },
        {
          field: 'embedding',
          dimensions: 1536,
          similarity: VectorSimilarity.Cosine,
        },
      ),
    ).toThrow(/not a vector/);
    expect(() =>
      assertVectorIndexMatchesField(validField, {
        field: 'embedding',
        dimensions: 768,
        similarity: VectorSimilarity.Cosine,
      }),
    ).toThrow(/dimensions mismatch/);
    expect(() =>
      assertVectorIndexContract('mongodb', {
        field: 'embedding',
        dimensions: 1536,
        similarity: 'manhattan' as VectorSimilarity,
        method: VectorIndexMethod.HNSW,
      }),
    ).toThrow(GrpcError);
    try {
      assertVectorIndexContract('mongodb', {
        field: 'embedding',
        dimensions: 1536,
        similarity: VectorSimilarity.Cosine,
        method: VectorIndexMethod.IVFFlat,
      });
      throw new Error('expected method rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(GrpcError);
      expect((err as GrpcError).code).toBe(status.INVALID_ARGUMENT);
    }
  });
});
