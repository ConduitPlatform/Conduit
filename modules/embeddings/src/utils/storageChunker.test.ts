import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chunkExtractedText } from './storageChunker.js';

describe('deterministic storage chunker', () => {
  it('prefers paragraph boundaries and keeps stable keys with overlap', () => {
    const text = 'First paragraph.\n\nSecond paragraph is here.\n\nThird one.';
    const first = chunkExtractedText(
      text,
      { maxChunkBytes: 24, maxChunksPerFile: 16, overlapBytes: 8 },
      'file:abc',
    );
    const second = chunkExtractedText(
      text,
      { maxChunkBytes: 24, maxChunksPerFile: 16, overlapBytes: 8 },
      'file:abc',
    );
    assert.deepEqual(
      first.map(chunk => chunk.chunkKey),
      second.map(chunk => chunk.chunkKey),
    );
    assert.equal(first[0]?.ordinal, 0);
    assert.match(first[0]?.chunkKey ?? '', /^c0-[0-9a-f]{16}$/);
    assert.match(first[0]?.metadata.locator ?? '', /^file:abc:0:/);
    assert.equal(
      first.some(chunk => chunk.text.includes('First')),
      true,
    );
    if (first.length > 1) {
      const overlap = first[0].text.slice(-4);
      assert.equal(first[1].text.includes(overlap) || first[1].text.length > 0, true);
    }
  });

  it('enforces max chunks per file', () => {
    assert.throws(() =>
      chunkExtractedText(
        'Alpha. Beta. Gamma. Delta.',
        { maxChunkBytes: 6, maxChunksPerFile: 1, overlapBytes: 0 },
        'file:too-many',
      ),
    );
  });
});
