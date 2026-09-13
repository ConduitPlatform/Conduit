import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_INBOUND_BUS_BYTES } from './constants.js';
import { parseBusPayload } from './process.js';
import { renderMessageTemplate } from './template.js';

describe('parseBusPayload inbound cap', () => {
  it('drops payloads larger than 256KiB before JSON.parse', () => {
    const oversized = JSON.stringify({ blob: 'x'.repeat(MAX_INBOUND_BUS_BYTES) });
    assert.throws(() => parseBusPayload(oversized), /exceeds/);
  });
});

describe('preview renderer parity', () => {
  it('renders templates the same as runtime processing', () => {
    const payload = { documentId: 'doc-1', nested: { value: 2 } };
    const template = { id: '{{payload.documentId}}', n: '{{payload.nested.value}}' };
    assert.deepEqual(renderMessageTemplate(template, payload), {
      id: 'doc-1',
      n: 2,
    });
  });
});
