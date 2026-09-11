import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hashedEmbeddingSource } from './configChange.js';
import {
  buildEmbeddingDocumentSelect,
  generateEmbeddingsForDocument,
} from './processEmbedding.js';

const config = {
  sourceFields: ['title', 'body'],
  targetField: 'embedding',
  dimensions: 2,
  provider: 'openai-compatible',
  modelName: 'test',
};

function hash(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

describe('embedding generation loop safety', () => {
  it('explicitly selects source fields and the hidden source hash', () => {
    assert.equal(
      buildEmbeddingDocumentSelect([config]),
      '+title +body +embeddingSourceHash',
    );
  });

  it('skips provider calls when the source hash already matches', async () => {
    const sourceHash = hashedEmbeddingSource(hash, 'Hello\nWorld', config);
    let embedCalls = 0;
    let updates = 0;
    const result = await generateEmbeddingsForDocument({
      doc: {
        _id: 'a',
        title: 'Hello',
        body: 'World',
        embeddingSourceHash: sourceHash,
      },
      configs: [config],
      hashInput: hash,
      embed: async () => {
        embedCalls += 1;
        return [1, 2];
      },
      update: async () => {
        updates += 1;
      },
    });
    assert.deepEqual(result, { generated: 0, skipped: 1 });
    assert.equal(embedCalls, 0);
    assert.equal(updates, 0);
  });

  it('performs one write with event suppression and does not loop on the write-back', async () => {
    const sourceHash = hashedEmbeddingSource(hash, 'Hello\nWorld', config);
    let embedCalls = 0;
    const updates: Array<{ fields: Record<string, unknown>; options: unknown }> = [];
    const doc: Record<string, unknown> = { _id: 'a', title: 'Hello', body: 'World' };

    const run = () =>
      generateEmbeddingsForDocument({
        doc,
        configs: [config],
        hashInput: hash,
        embed: async () => {
          embedCalls += 1;
          return [1, 2];
        },
        update: async (fields, options) => {
          updates.push({ fields, options });
        },
      });

    const first = await run();
    const second = await run();

    assert.deepEqual(first, { generated: 1, skipped: 0 });
    assert.deepEqual(second, { generated: 0, skipped: 1 });
    assert.equal(embedCalls, 1);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].options, { suppressEvent: true });
    assert.equal(updates[0].fields.embeddingSourceHash, sourceHash);
  });

  it('does not skip when stored hashes were computed without the material config fingerprint', async () => {
    let embedCalls = 0;
    const result = await generateEmbeddingsForDocument({
      doc: {
        _id: 'a',
        title: 'Hello',
        body: 'World',
        embeddingSourceHash: hash('Hello\nWorld'),
      },
      configs: [{ ...config, modelName: 'text-embedding-3-large' }],
      hashInput: hash,
      embed: async () => {
        embedCalls += 1;
        return [1, 2];
      },
      update: async () => undefined,
    });
    assert.deepEqual(result, { generated: 1, skipped: 0 });
    assert.equal(embedCalls, 1);
  });
});
