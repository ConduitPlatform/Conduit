import { describe, expect, it } from '@jest/globals';
import { GrpcError, TYPE } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertEmbeddingsJobCaller,
  assertEmbeddingsJobRead,
  assertEmbeddingsJobWrite,
} from '../embeddingsJobContext.js';
import { canModify } from '../../../permissions/index.js';

const articleSchema = {
  name: 'Article',
  compiledFields: {
    title: { type: TYPE.String },
    body: { type: TYPE.String },
    views: { type: TYPE.Number },
    embedding: { type: TYPE.Vector, dimensions: 2 },
    embeddingSourceHash: { type: TYPE.String, select: false },
  },
  extensions: [
    {
      ownerModule: 'embeddings',
      fields: {
        embedding: { type: TYPE.Vector, dimensions: 2 },
        embeddingSourceHash: { type: TYPE.String, select: false },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

describe('embeddings job context', () => {
  it('rejects callers that are not the embeddings module', () => {
    try {
      assertEmbeddingsJobCaller('database');
      throw new Error('expected failure');
    } catch (err) {
      expect((err as GrpcError).code).toBe(status.PERMISSION_DENIED);
    }
    expect(() => assertEmbeddingsJobCaller('embeddings')).not.toThrow();
  });

  it('allows configured source and hash reads by id only', () => {
    expect(() =>
      assertEmbeddingsJobRead({
        query: { _id: 'doc-1' },
        select: '+title +body +embeddingSourceHash',
        allowedFields: ['title', 'body', 'embeddingSourceHash'],
        schema: articleSchema,
      }),
    ).not.toThrow();
  });

  it('rejects collection scans, extra selected fields, and non-string sources', () => {
    expect(() =>
      assertEmbeddingsJobRead({
        query: { title: 'x' },
        select: '+title',
        allowedFields: ['title'],
        schema: articleSchema,
      }),
    ).toThrow(GrpcError);
    expect(() =>
      assertEmbeddingsJobRead({
        query: { _id: 'doc-1' },
        select: '+title +password',
        allowedFields: ['title', 'embeddingSourceHash'],
        schema: articleSchema,
      }),
    ).toThrow(GrpcError);
    expect(() =>
      assertEmbeddingsJobRead({
        query: { _id: 'doc-1' },
        select: '+views',
        allowedFields: ['views'],
        schema: articleSchema,
      }),
    ).toThrow(GrpcError);
  });

  it('allows embeddings-owned vector and hash writes and rejects other fields', () => {
    expect(() =>
      assertEmbeddingsJobWrite({
        document: { embedding: [0.1, 0.2], embeddingSourceHash: 'abc' },
        schema: articleSchema,
      }),
    ).not.toThrow();
    expect(() =>
      assertEmbeddingsJobWrite({
        document: { $set: { embedding: [0.1, 0.2] } },
        schema: articleSchema,
      }),
    ).not.toThrow();
    try {
      assertEmbeddingsJobWrite({
        document: { title: 'nope' },
        schema: articleSchema,
      });
      throw new Error('expected failure');
    } catch (err) {
      expect((err as GrpcError).code).toBe(status.PERMISSION_DENIED);
    }
    expect(() =>
      assertEmbeddingsJobWrite({
        document: { $unset: { title: 1 } },
        schema: articleSchema,
      }),
    ).toThrow(GrpcError);
  });

  it('does not change global canModify behavior', async () => {
    const schema = {
      originalSchema: {
        name: 'Article',
        ownerModule: 'database',
        modelOptions: { conduit: { permissions: { canModify: 'Nothing' } } },
        extensions: articleSchema.extensions,
      },
    };
    await expect(canModify('embeddings', schema as never, { title: 'x' })).resolves.toBe(
      false,
    );
    await expect(canModify('database', schema as never, { title: 'x' })).resolves.toBe(
      true,
    );
  });
});
