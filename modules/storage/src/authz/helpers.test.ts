import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import {
  actorSubject,
  escapeRegex,
  folderPrefixRegex,
  isAuthzEnabled,
  isDefaultContainer,
  isUsableSubject,
  parsePersonalFolderOwner,
  personalFolderName,
  resolveClientFolder,
  resolveFileId,
  resolveScope,
  resolveUserId,
  rethrowGrpcOrInternal,
} from './helpers.js';

const originalConfig = ConfigController.getInstance().config;

afterEach(() => {
  ConfigController.getInstance().config = originalConfig;
});

describe('personal folder resolution', () => {
  it('uses cnd_<userId>/ when the folder is omitted', () => {
    assert.equal(resolveClientFolder(undefined, 'user-1'), 'cnd_user-1/');
    assert.equal(resolveClientFolder('', 'user-1'), 'cnd_user-1/');
    assert.equal(resolveClientFolder('   ', 'user-1'), 'cnd_user-1/');
    assert.equal(personalFolderName('user-1'), 'cnd_user-1/');
  });

  it('keeps an explicit root or named folder', () => {
    assert.equal(resolveClientFolder('/', 'user-1'), '/');
    assert.equal(resolveClientFolder('docs', 'user-1'), 'docs/');
    assert.equal(resolveClientFolder('docs/nested', 'user-1'), 'docs/nested/');
  });

  it('parses the personal-folder owner from a path', () => {
    assert.equal(parsePersonalFolderOwner('cnd_other/'), 'other');
    assert.equal(parsePersonalFolderOwner('cnd_other/sub/'), 'other');
    assert.equal(parsePersonalFolderOwner('docs/'), undefined);
  });
});

describe('request field resolution', () => {
  it('reads gRPC delete ids from params and falls back to urlParams', () => {
    assert.equal(
      resolveFileId({ params: { id: 'from-params' }, urlParams: {} }),
      'from-params',
    );
    assert.equal(
      resolveFileId({ params: {}, urlParams: { id: 'from-url' } }),
      'from-url',
    );
    assert.equal(
      resolveFileId({ params: { id: 'from-params' }, urlParams: { id: 'from-url' } }),
      'from-params',
    );
    assert.equal(resolveFileId({ params: {}, urlParams: {} }), undefined);
  });

  it('resolves scope from queryParams or params', () => {
    assert.equal(
      resolveScope({ queryParams: { scope: 'Team:t1' }, params: {} }),
      'Team:t1',
    );
    assert.equal(
      resolveScope({ queryParams: {}, params: { scope: 'Team:t2' } }),
      'Team:t2',
    );
  });

  it('does not throw when user is missing', () => {
    assert.equal(resolveUserId({ context: {} }), undefined);
    assert.equal(resolveUserId({ context: { user: {} } }), undefined);
    assert.equal(resolveUserId({ context: { user: { _id: '' } } }), undefined);
    assert.equal(resolveUserId({ context: { user: { _id: 'u1' } } }), 'u1');
    assert.equal(actorSubject({ context: { user: { _id: 'u1' } } }), 'User:u1');
    assert.equal(
      actorSubject({
        context: { user: { _id: 'u1' } },
        queryParams: { scope: 'Team:t1' },
      }),
      'Team:t1',
    );
  });
});

describe('authz helpers', () => {
  it('escapes regex metacharacters for folder prefix deletes', () => {
    assert.equal(escapeRegex('foo.bar/'), 'foo\\.bar/');
    assert.deepEqual(folderPrefixRegex('foo.bar/'), { $regex: '^foo\\.bar/' });
  });

  it('treats empty subjects as unusable', () => {
    assert.equal(isUsableSubject(undefined), false);
    assert.equal(isUsableSubject(''), false);
    assert.equal(isUsableSubject('User:1'), true);
  });

  it('reads authz and default container from config', () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    assert.equal(isAuthzEnabled(), true);
    assert.equal(isDefaultContainer('conduit'), true);
    assert.equal(isDefaultContainer('other'), false);

    ConfigController.getInstance().config = {
      authorization: { enabled: false },
      defaultContainer: 'conduit',
    };
    assert.equal(isAuthzEnabled(), false);
  });

  it('rethrows GrpcError 403/404 instead of wrapping them as INTERNAL', () => {
    const denied = new GrpcError(status.PERMISSION_DENIED, 'nope');
    assert.throws(
      () => rethrowGrpcOrInternal(denied),
      (error: unknown) => {
        return error instanceof GrpcError && error.code === status.PERMISSION_DENIED;
      },
    );
    const missing = new GrpcError(status.NOT_FOUND, 'gone');
    assert.throws(
      () => rethrowGrpcOrInternal(missing),
      (error: unknown) => {
        return error instanceof GrpcError && error.code === status.NOT_FOUND;
      },
    );
    assert.throws(
      () => rethrowGrpcOrInternal(new Error('boom')),
      (error: unknown) => {
        return error instanceof GrpcError && error.code === status.INTERNAL;
      },
    );
  });
});
