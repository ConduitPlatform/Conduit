import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  configureSessionServicesFromSdk,
  getRedisKeyValue,
  indexUserSession,
  resetSessionServices,
  revokeSessions,
} from './sessionServices.js';
import { invalidateTeamClaims, loadTeamClaims } from './teamClaims.js';
import { createFakeRedis } from './fakeSession.testutil.js';

function fakeSdk(failFirst = false) {
  const fake = createFakeRedis();
  const state = { getClient: 0, fail: failFirst };
  const sdk = {
    redisManager: {
      getClient: () => {
        state.getClient += 1;
        if (state.fail) {
          state.fail = false;
          throw new Error('redis not initialized');
        }
        return fake.redis;
      },
    },
    get sessionRegistry() {
      return {
        revokeMany: async () => undefined,
      };
    },
    get userCache(): never {
      throw new Error('redis not initialized');
    },
  } as unknown as ConduitGrpcSdk;
  return { sdk, state, fake };
}

beforeEach(() => resetSessionServices());

describe('shared redis client', () => {
  it('is created once and reused by every consumer', async () => {
    const { sdk, state, fake } = fakeSdk();
    configureSessionServicesFromSdk(sdk);
    assert.equal(state.getClient, 0, 'lazy');
    const findRelations = async () => ({ relations: [] });
    for (let i = 0; i < 5; i++) {
      await loadTeamClaims(`u${i}`, { findRelations });
      await invalidateTeamClaims([`u${i}`]);
      await indexUserSession(`u${i}`, 'sid', 1000);
      await revokeSessions([], 'test', { userIds: [`u${i}`] });
      getRedisKeyValue();
    }
    assert.equal(state.getClient, 1);
    assert.equal(getRedisKeyValue(), fake.redis);
  });
  it('a failing getClient yields no client and is retried later', () => {
    const { sdk, state, fake } = fakeSdk(true);
    configureSessionServicesFromSdk(sdk);
    assert.equal(getRedisKeyValue(), undefined);
    assert.equal(getRedisKeyValue(), fake.redis);
    assert.equal(getRedisKeyValue(), fake.redis);
    assert.equal(state.getClient, 2);
  });
});
