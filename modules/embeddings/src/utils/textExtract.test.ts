import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractCsvText, extractJsonText, extractUtf8Text } from './textExtract.js';

describe('deterministic UTF-8 text extractors', () => {
  it('strips a BOM and rejects invalid UTF-8', () => {
    assert.equal(extractUtf8Text(Buffer.from('\uFEFFhello'), 32), 'hello');
    assert.throws(() => extractUtf8Text(Buffer.from([0xff, 0xfe, 0x00]), 32));
  });

  it('parses JSON and copies CSV within extracted-byte limits', () => {
    assert.equal(extractJsonText(Buffer.from('{"ok":true}'), 64), '{"ok":true}');
    assert.throws(() => extractJsonText(Buffer.from('{"ok":'), 64));
    assert.equal(extractCsvText(Buffer.from('a,b\n1,2\n'), 64), 'a,b\n1,2\n');
    assert.throws(() => extractUtf8Text(Buffer.from('hello world'), 4));
  });
});
