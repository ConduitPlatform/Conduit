import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStorageGrpcRequest,
  callerModuleName,
  isUntrustedScopeOnlyCaller,
  nonEmptyAuthzString,
  storageGrpcContext,
} from './storageGrpcRequest.js';

function metadata(moduleName?: string) {
  return {
    get(key: string) {
      if (key === 'module-name' && moduleName) return [moduleName];
      return [];
    },
  };
}

describe('storage gRPC request context', () => {
  it('omits empty userId so scope-only module calls stay userless', () => {
    assert.equal(nonEmptyAuthzString(''), undefined);
    assert.equal(nonEmptyAuthzString('   '), undefined);
    assert.equal(nonEmptyAuthzString('user-1'), 'user-1');
    const emptyUser = buildStorageGrpcRequest({
      request: { userId: '', scope: 'Team:tenant-a' },
      metadata: metadata('embeddings'),
    });
    assert.equal(emptyUser.useClientHandlers, true);
    assert.equal(emptyUser.request.request.context.user, undefined);
    assert.equal(emptyUser.request.request.context.scope, 'Team:tenant-a');
    assert.equal(emptyUser.request.request.context.callerModule, 'embeddings');
    assert.equal(emptyUser.request.request.queryParams.scope, 'Team:tenant-a');
  });

  it('attaches a real user and keeps no-subject calls on admin handlers', () => {
    const userCall = buildStorageGrpcRequest({
      request: { userId: 'user-1', scope: 'Team:org' },
    });
    assert.deepEqual(userCall.request.request.context.user, { _id: 'user-1' });
    assert.equal(userCall.useClientHandlers, true);
    const adminCall = buildStorageGrpcRequest({
      request: { userId: '', scope: '' },
    });
    assert.equal(adminCall.useClientHandlers, false);
    assert.equal(adminCall.request.request.context.user, undefined);
    assert.equal(adminCall.request.request.context.scope, undefined);
  });

  it('treats router and client metadata as untrusted scope-only callers', () => {
    assert.equal(isUntrustedScopeOnlyCaller('router'), true);
    assert.equal(isUntrustedScopeOnlyCaller('client'), true);
    assert.equal(isUntrustedScopeOnlyCaller('embeddings'), false);
    assert.equal(isUntrustedScopeOnlyCaller(undefined), false);
    assert.equal(callerModuleName(metadata('router')), 'router');
    assert.equal(storageGrpcContext({ userId: '', scope: 'Team:org' }).user, undefined);
  });
});
