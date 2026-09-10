import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertAutomaticExtractable, sniffMimeType } from './mimeSniff.js';

describe('storage MIME sniffing', () => {
  it('sniffs automatic text formats and PDF magic', () => {
    assert.equal(sniffMimeType(Buffer.from('%PDF-1.4\n')), 'application/pdf');
    assert.equal(sniffMimeType(Buffer.from('{"a":1}')), 'application/json');
    assert.equal(sniffMimeType(Buffer.from('a,b\n1,2\n')), 'text/csv');
    assert.equal(sniffMimeType(Buffer.from('# Title\n\nbody')), 'text/markdown');
    assert.equal(sniffMimeType(Buffer.from('hello world')), 'text/plain');
  });

  it('rejects archives, office magics, and declared/sniffed mismatches', () => {
    assert.equal(sniffMimeType(Buffer.from([0x50, 0x4b, 0x03, 0x04])), 'application/zip');
    assert.equal(
      sniffMimeType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x11, 0x11])),
      'application/octet-stream',
    );
    assert.throws(() =>
      assertAutomaticExtractable({
        declaredMime: 'application/pdf',
        sniffed: 'application/zip',
      }),
    );
    assert.throws(() =>
      assertAutomaticExtractable({
        declaredMime: 'application/pdf',
        sniffed: 'text/plain',
      }),
    );
    assert.equal(
      assertAutomaticExtractable({
        declaredMime: 'text/plain',
        sniffed: 'application/json',
      }),
      'application/json',
    );
    assert.throws(() =>
      assertAutomaticExtractable({
        sniffed: 'application/octet-stream',
      }),
    );
  });
});
