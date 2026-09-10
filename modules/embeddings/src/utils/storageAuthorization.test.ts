import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertStorageAuthorizationUsable,
  resolveStorageAuthorizationState,
  storageAuthorizationWarnings,
} from './storageAuthorization.js';

describe('storage authorization usability', () => {
  it('treats enabled Storage ReBAC plus a serving Authorization module as usable', async () => {
    const state = await resolveStorageAuthorizationState({
      storageAvailable: true,
      authorizationAvailable: true,
      getStorageConfig: async () => ({ authorization: { enabled: true } }),
    });
    assert.deepEqual(state, { usable: true });
    assert.deepEqual(storageAuthorizationWarnings(state), []);
    assert.doesNotThrow(() => assertStorageAuthorizationUsable(state));
  });

  it('does not fail open when Storage authorization is disabled', async () => {
    const state = await resolveStorageAuthorizationState({
      storageAvailable: true,
      authorizationAvailable: true,
      getStorageConfig: async () => ({ authorization: { enabled: false } }),
    });
    assert.deepEqual(state, {
      usable: false,
      reason: 'storage_authorization_disabled',
    });
    assert.match(
      storageAuthorizationWarnings(state)[0] ?? '',
      /Storage authorization is disabled/,
    );
    await assert.rejects(
      async () => assertStorageAuthorizationUsable(state),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.FAILED_PRECONDITION &&
        /Selectors are not a tenant boundary/.test(err.message),
    );
  });

  it('does not fail open when Authorization or Storage is unavailable', async () => {
    const missingAuthz = await resolveStorageAuthorizationState({
      storageAvailable: true,
      authorizationAvailable: false,
    });
    assert.deepEqual(missingAuthz, {
      usable: false,
      reason: 'authorization_unavailable',
    });
    const missingStorage = await resolveStorageAuthorizationState({
      storageAvailable: false,
      authorizationAvailable: true,
      getStorageConfig: async () => ({ authorization: { enabled: true } }),
    });
    assert.deepEqual(missingStorage, {
      usable: false,
      reason: 'storage_unavailable',
    });
    const unreadConfig = await resolveStorageAuthorizationState({
      storageAvailable: true,
      authorizationAvailable: true,
      getStorageConfig: async () => {
        throw new Error('config unavailable');
      },
    });
    assert.deepEqual(unreadConfig, {
      usable: false,
      reason: 'storage_unavailable',
    });
    assert.throws(
      () => assertStorageAuthorizationUsable(undefined),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.FAILED_PRECONDITION &&
        /Authorization is unavailable/.test(err.message),
    );
  });

  it('retries a stale Storage availability miss then fails closed if still down', async () => {
    let storageChecks = 0;
    const recovered = await resolveStorageAuthorizationState({
      storageAvailable: false,
      authorizationAvailable: true,
      probeStorageAvailable: async () => {
        storageChecks += 1;
        return storageChecks >= 3;
      },
      probeAuthorizationAvailable: async () => true,
      getStorageConfig: async () => ({ authorization: { enabled: true } }),
      retry: { attempts: 4, delayMs: 0 },
    });
    assert.deepEqual(recovered, { usable: true });
    assert.equal(storageChecks, 3);

    let downChecks = 0;
    const stillDown = await resolveStorageAuthorizationState({
      storageAvailable: true,
      probeStorageAvailable: async () => {
        downChecks += 1;
        return false;
      },
      probeAuthorizationAvailable: async () => true,
      getStorageConfig: async () => ({ authorization: { enabled: true } }),
      retry: { attempts: 3, delayMs: 0 },
    });
    assert.deepEqual(stillDown, { usable: false, reason: 'storage_unavailable' });
    assert.equal(downChecks, 3);
  });
});
