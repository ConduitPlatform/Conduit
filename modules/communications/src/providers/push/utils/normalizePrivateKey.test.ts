import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { normalizePrivateKey } from './normalizePrivateKey.js';

const { privateKey: PEM } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

describe('normalizePrivateKey', () => {
  const variants: Record<string, string> = {
    'unchanged PEM': PEM,
    'escaped newlines': PEM.replace(/\n/g, '\\n'),
    'newlines stripped (single-line input)': PEM.replace(/\n/g, ''),
    'newlines turned into spaces': PEM.replace(/\n/g, ' '),
    'CRLF line endings': PEM.replace(/\n/g, '\r\n'),
    'JSON-quoted': JSON.stringify(PEM),
  };

  for (const [name, input] of Object.entries(variants)) {
    it(`restores a parseable key from: ${name}`, () => {
      const normalized = normalizePrivateKey(input);
      assert.equal(normalized, PEM);
      assert.doesNotThrow(() => createPrivateKey(normalized));
    });
  }

  it('leaves non-PEM values alone', () => {
    assert.equal(normalizePrivateKey(''), '');
    assert.equal(normalizePrivateKey('not-a-key'), 'not-a-key');
  });
});
