import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError, TYPE } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertCanManageEmbeddingConfig,
  assertEmbeddingTargetSchema,
  assertSemanticSearchAccess,
  assertSourceFields,
  isDeniedEmbeddingSchema,
  resolveAdminOperatorContext,
  resolveSourceFieldAllowlist,
} from './schemaPolicy.js';

describe('embedding schema and source policies', () => {
  it('denies system, auth-secret, and embeddings-owned schemas', () => {
    assert.equal(isDeniedEmbeddingSchema({ name: 'EmbeddingConfig' }), true);
    assert.equal(isDeniedEmbeddingSchema({ name: 'BackfillRun' }), true);
    assert.equal(
      isDeniedEmbeddingSchema({ name: 'CustomOps', ownerModule: 'embeddings' }),
      true,
    );
    assert.equal(isDeniedEmbeddingSchema({ name: '_DeclaredSchema' }), true);
    assert.equal(
      isDeniedEmbeddingSchema({ name: 'Views', ownerModule: 'database' }),
      true,
    );
    assert.equal(
      isDeniedEmbeddingSchema({ name: 'AccessToken', ownerModule: 'authentication' }),
      true,
    );
    assert.equal(
      isDeniedEmbeddingSchema({ name: 'TwoFactorSecret', ownerModule: 'authentication' }),
      true,
    );
    assert.equal(
      isDeniedEmbeddingSchema({ name: 'Article', ownerModule: 'cms-app' }),
      false,
    );
    assert.equal(
      isDeniedEmbeddingSchema({ name: 'User', ownerModule: 'authentication' }),
      false,
    );
    assert.equal(
      isDeniedEmbeddingSchema({ name: 'File', ownerModule: 'storage' }),
      false,
    );
    assert.throws(
      () => assertEmbeddingTargetSchema({ name: 'RefreshToken' }),
      err => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
  });

  it('restricts config and backfill to the schema owner or platform admin', () => {
    assert.doesNotThrow(() =>
      assertCanManageEmbeddingConfig({
        callerModule: 'cms-app',
        ownerModule: 'cms-app',
        schemaName: 'Article',
      }),
    );
    assert.doesNotThrow(() =>
      assertCanManageEmbeddingConfig({
        callerModule: 'database',
        ownerModule: 'cms-app',
        schemaName: 'Article',
      }),
    );
    assert.throws(
      () =>
        assertCanManageEmbeddingConfig({
          callerModule: 'chat',
          ownerModule: 'cms-app',
          schemaName: 'Article',
        }),
      err => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
  });

  it('rejects hidden, non-string, and sensitive source fields unless allowlisted', () => {
    const schemaFields = {
      title: { type: TYPE.String },
      body: { type: TYPE.String },
      password: { type: TYPE.String },
      token: { type: TYPE.String, select: false },
      views: { type: TYPE.Number },
      notes: { type: TYPE.String, select: false },
    };
    assert.doesNotThrow(() =>
      assertSourceFields({
        sourceFields: ['title', 'body'],
        schemaFields,
      }),
    );
    assert.throws(
      () => assertSourceFields({ sourceFields: ['password'], schemaFields }),
      /sensitive/,
    );
    assert.throws(
      () => assertSourceFields({ sourceFields: ['token'], schemaFields }),
      /hidden|sensitive/,
    );
    assert.throws(
      () => assertSourceFields({ sourceFields: ['views'], schemaFields }),
      /string-like/,
    );
    assert.throws(
      () => assertSourceFields({ sourceFields: ['notes'], schemaFields }),
      /hidden/,
    );
    assert.doesNotThrow(() =>
      assertSourceFields({
        sourceFields: ['notes'],
        schemaFields,
        allowlist: ['notes'],
      }),
    );
  });

  it('honors caller-supplied sourceFieldAllowlist only for platform-admin context', () => {
    assert.deepEqual(
      resolveSourceFieldAllowlist({
        operatorAllowlist: ['summary'],
        requestAllowlist: ['password', 'notes'],
        platformAdmin: false,
      }),
      ['summary'],
    );
    assert.deepEqual(
      resolveSourceFieldAllowlist({
        operatorAllowlist: ['summary'],
        requestAllowlist: ['password', 'notes'],
        platformAdmin: true,
      }),
      ['summary', 'password', 'notes'],
    );
  });

  it('requires subject, scope, or a verified admin operator for semantic search', () => {
    assert.throws(
      () => assertSemanticSearchAccess({}),
      err => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    assert.doesNotThrow(() => assertSemanticSearchAccess({ userId: 'u1' }));
    assert.doesNotThrow(() =>
      assertSemanticSearchAccess({
        adminOperator: resolveAdminOperatorContext({
          requested: true,
          callerModule: 'core',
        }),
      }),
    );
    assert.throws(
      () =>
        resolveAdminOperatorContext({
          requested: true,
          callerModule: 'chat',
        }),
      err => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
  });
});
