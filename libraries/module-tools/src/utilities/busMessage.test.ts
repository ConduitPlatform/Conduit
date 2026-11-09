import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBusJson } from './busMessage.ts';

describe('parseBusJson', () => {
  it('parses a JSON payload', () => {
    const parsed = parseBusJson('{"active":true}');
    assert.deepEqual(parsed, { ok: true, value: { active: true } });
  });

  it('returns an error for a bare string instead of throwing', () => {
    const parsed = parseBusJson('reconciling');
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, /reconciling/);
  });
});
