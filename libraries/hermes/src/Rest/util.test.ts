import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapGrpcErrorToHttp } from './util.js';

describe('mapGrpcErrorToHttp', () => {
  it('maps ALREADY_EXISTS (6) to HTTP 409', () => {
    const result = mapGrpcErrorToHttp(6);
    assert.equal(result.status, 409);
    assert.equal(result.name, 'CONFLICT');
  });

  it('maps NOT_FOUND (5) to HTTP 404', () => {
    const result = mapGrpcErrorToHttp(5);
    assert.equal(result.status, 404);
    assert.equal(result.name, 'NOT_FOUND');
  });
});
