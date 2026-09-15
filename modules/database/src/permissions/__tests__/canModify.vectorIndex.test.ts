import { describe, expect, it } from '@jest/globals';
import { TYPE } from '@conduitplatform/grpc-sdk';
import {
  canModify,
  vectorIndexDeleteMutationData,
  vectorIndexMutationData,
} from '../index.js';

const embeddingExtension = {
  ownerModule: 'embeddings',
  fields: {
    embedding: { type: TYPE.Vector, dimensions: 3 },
    embeddingSourceHash: { type: TYPE.String, select: false },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

function schema(args: {
  ownerModule: string;
  canModify: 'Everything' | 'Nothing' | 'ExtensionOnly';
  name?: string;
}) {
  return {
    originalSchema: {
      name: args.name ?? 'User',
      ownerModule: args.ownerModule,
      modelOptions: { conduit: { permissions: { canModify: args.canModify } } },
      extensions: [embeddingExtension],
    },
  };
}

describe('createVectorIndex canModify field evaluation', () => {
  it('allows embeddings to index its own extension field on ExtensionOnly schemas', async () => {
    const user = schema({ ownerModule: 'authentication', canModify: 'ExtensionOnly' });
    await expect(
      canModify('embeddings', user as never, vectorIndexMutationData('embedding')),
    ).resolves.toBe(true);
  });

  it('denies embeddings indexing unrelated fields on ExtensionOnly schemas', async () => {
    const user = schema({ ownerModule: 'authentication', canModify: 'ExtensionOnly' });
    await expect(
      canModify('embeddings', user as never, vectorIndexMutationData('email')),
    ).resolves.toBe(false);
    await expect(
      canModify('chat', user as never, vectorIndexMutationData('embedding')),
    ).resolves.toBe(false);
  });

  it('preserves owner and Everything authorization without field data', async () => {
    const owned = schema({ ownerModule: 'authentication', canModify: 'ExtensionOnly' });
    const open = schema({
      ownerModule: 'database',
      canModify: 'Everything',
      name: 'Article',
    });
    await expect(canModify('authentication', owned as never)).resolves.toBe(true);
    await expect(
      canModify('authentication', owned as never, vectorIndexMutationData('email')),
    ).resolves.toBe(true);
    await expect(canModify('embeddings', open as never)).resolves.toBe(true);
    await expect(
      canModify('chat', open as never, vectorIndexMutationData('title')),
    ).resolves.toBe(true);
  });

  it('denies ExtensionOnly callers when the vector field is missing', async () => {
    const user = schema({ ownerModule: 'authentication', canModify: 'ExtensionOnly' });
    await expect(canModify('embeddings', user as never)).resolves.toBe(false);
    await expect(
      canModify('embeddings', user as never, vectorIndexMutationData('')),
    ).resolves.toBe(false);
  });
});

describe('deleteVectorIndex canModify field evaluation', () => {
  const liveIndexes = [
    { name: 'embedding_vector', field: 'embedding' },
    { name: 'email_1', field: 'email' },
  ];

  it('allows embeddings to delete its own live extension index on ExtensionOnly schemas', async () => {
    const user = schema({ ownerModule: 'authentication', canModify: 'ExtensionOnly' });
    await expect(
      canModify(
        'embeddings',
        user as never,
        vectorIndexDeleteMutationData(liveIndexes, 'embedding_vector'),
      ),
    ).resolves.toBe(true);
  });

  it('denies unknown and non-vector index names on ExtensionOnly schemas', async () => {
    const user = schema({ ownerModule: 'authentication', canModify: 'ExtensionOnly' });
    await expect(
      canModify(
        'embeddings',
        user as never,
        vectorIndexDeleteMutationData(liveIndexes, 'missing_vector'),
      ),
    ).resolves.toBe(false);
    await expect(
      canModify(
        'embeddings',
        user as never,
        vectorIndexDeleteMutationData([], 'embedding_vector'),
      ),
    ).resolves.toBe(false);
    await expect(
      canModify(
        'embeddings',
        user as never,
        vectorIndexDeleteMutationData([{ name: 'title_idx' }], 'title_idx'),
      ),
    ).resolves.toBe(false);
  });

  it('denies unowned live vector indexes on ExtensionOnly schemas', async () => {
    const user = schema({ ownerModule: 'authentication', canModify: 'ExtensionOnly' });
    await expect(
      canModify(
        'embeddings',
        user as never,
        vectorIndexDeleteMutationData(liveIndexes, 'email_1'),
      ),
    ).resolves.toBe(false);
    await expect(
      canModify(
        'chat',
        user as never,
        vectorIndexDeleteMutationData(liveIndexes, 'embedding_vector'),
      ),
    ).resolves.toBe(false);
  });
});
