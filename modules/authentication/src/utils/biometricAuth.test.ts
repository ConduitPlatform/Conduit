import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  BIOMETRIC_CHALLENGE_TTL_MS,
  BIOMETRIC_CHALLENGE_UNAVAILABLE,
  biometricChallengeLockResource,
  consumeBiometricChallenge,
  findReusableBiometricChallenge,
  isBiometricChallengeExpired,
  issueOrReuseBiometricLoginChallenge,
  verifyBiometricSignature,
} from './biometricAuth.js';

function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
}

function signChallenge(privateKeyDer: Buffer, challenge: string): string {
  const signer = crypto.createSign('sha256WithRSAEncryption');
  signer.update(new Uint8Array(Buffer.from(challenge)));
  return signer.sign(
    crypto.createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' }),
    'base64',
  );
}

describe('isBiometricChallengeExpired', () => {
  it('accepts a fresh challenge', () => {
    assert.equal(isBiometricChallengeExpired(new Date(), Date.now()), false);
  });

  it('rejects a challenge older than the TTL', () => {
    const createdAt = new Date(Date.now() - BIOMETRIC_CHALLENGE_TTL_MS - 1);
    assert.equal(isBiometricChallengeExpired(createdAt), true);
  });
});

describe('findReusableBiometricChallenge', () => {
  it('returns a fresh newest token for the same client', () => {
    const token = {
      createdAt: new Date(),
      data: { clientId: 'ios-app', challenge: 'abc' },
    };
    assert.equal(findReusableBiometricChallenge(token, 'ios-app'), token);
  });

  it('returns null when the newest token belongs to another client', () => {
    const token = {
      createdAt: new Date(),
      data: { clientId: 'ios-app', challenge: 'abc' },
    };
    assert.equal(findReusableBiometricChallenge(token, 'android-app'), null);
  });

  it('returns null when the newest token has no clientId', () => {
    const token = {
      createdAt: new Date(),
      data: { clientId: undefined, challenge: 'abc' },
    };
    assert.equal(findReusableBiometricChallenge(token, 'ios-app'), null);
  });

  it('returns null when the newest token is expired', () => {
    const token = {
      createdAt: new Date(Date.now() - BIOMETRIC_CHALLENGE_TTL_MS - 1),
      data: { clientId: 'ios-app', challenge: 'abc' },
    };
    assert.equal(findReusableBiometricChallenge(token, 'ios-app'), null);
  });

  it('returns null when there is no token', () => {
    assert.equal(findReusableBiometricChallenge(null, 'ios-app'), null);
  });

  it('returns null when the newest token has an empty challenge', () => {
    const token = {
      createdAt: new Date(),
      data: { clientId: 'ios-app', challenge: '   ' },
    };
    assert.equal(findReusableBiometricChallenge(token, 'ios-app'), null);
  });
});

describe('consumeBiometricChallenge', () => {
  it('consumes a matching-client token and returns the stored clientId', async () => {
    const deletes: string[] = [];
    const clientId = await consumeBiometricChallenge(
      { _id: 'tok-1', data: { clientId: 'ios-app' } },
      'ios-app',
      async id => {
        deletes.push(id);
        return { deletedCount: 1 };
      },
    );
    assert.equal(clientId, 'ios-app');
    assert.deepEqual(deletes, ['tok-1']);
  });

  it('rejects a mismatched client without consuming', async () => {
    let consumed = false;
    await assert.rejects(
      () =>
        consumeBiometricChallenge(
          { _id: 'tok-1', data: { clientId: 'ios-app' } },
          'android-app',
          async () => {
            consumed = true;
            return { deletedCount: 1 };
          },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.PERMISSION_DENIED &&
        err.message === "Responding client doesn't match requesting!",
    );
    assert.equal(consumed, false);
  });

  it('rejects a token with no clientId without consuming', async () => {
    let consumed = false;
    await assert.rejects(
      () =>
        consumeBiometricChallenge({ _id: 'tok-1', data: {} }, 'ios-app', async () => {
          consumed = true;
          return { deletedCount: 1 };
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    assert.equal(consumed, false);
  });

  it('rejects when deleteOne loses the race', async () => {
    await assert.rejects(
      () =>
        consumeBiometricChallenge(
          { _id: 'tok-1', data: { clientId: 'ios-app' } },
          'ios-app',
          async () => ({ deletedCount: 0 }),
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message === 'Invalid signature!',
    );
  });
});

describe('verifyBiometricSignature', () => {
  it('accepts a signature over the challenge (happy path)', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const challenge = crypto.randomBytes(64).toString('hex');
    const signature = signChallenge(privateKey, challenge);
    assert.equal(
      verifyBiometricSignature(publicKey.toString('base64'), challenge, signature),
      true,
    );
  });

  it('rejects a signature over a different payload (replay of user._id style)', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const challenge = crypto.randomBytes(64).toString('hex');
    const signature = signChallenge(privateKey, 'user-id-instead-of-challenge');
    assert.equal(
      verifyBiometricSignature(publicKey.toString('base64'), challenge, signature),
      false,
    );
  });
});

type StoredChallenge = {
  _id: string;
  createdAt: Date;
  data: { clientId: string; challenge: string };
};

function serializeUsingLock() {
  let queue = Promise.resolve();
  return async <R>(
    _resource: string,
    _ttl: number,
    fn: (signal: AbortSignal) => Promise<R>,
  ) => {
    const run = () => fn(new AbortController().signal);
    const next = queue.then(run, run);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}

function createStore(initial: StoredChallenge[] = []) {
  const tokens = [...initial];
  let creates = 0;
  let deletes = 0;
  let ids = 0;
  return {
    tokens,
    get creates() {
      return creates;
    },
    get deletes() {
      return deletes;
    },
    findNewest: async (clientId: string) => {
      const scoped = tokens
        .filter(token => token.data.clientId === clientId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return scoped[0] ?? null;
    },
    deleteScope: async (clientId: string) => {
      deletes += 1;
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].data.clientId === clientId) {
          tokens.splice(i, 1);
        }
      }
    },
    createToken: async (clientId: string, challenge: string) => {
      creates += 1;
      ids += 1;
      const created: StoredChallenge = {
        _id: `tok-${ids}`,
        createdAt: new Date(),
        data: { clientId, challenge },
      };
      tokens.push(created);
      return created;
    },
  };
}

describe('issueOrReuseBiometricLoginChallenge', () => {
  it('reuses a fresh challenge without delete or create', async () => {
    const store = createStore([
      {
        _id: 'tok-1',
        createdAt: new Date(),
        data: { clientId: 'ios-app', challenge: 'live-challenge' },
      },
    ]);
    const challenge = await issueOrReuseBiometricLoginChallenge('key-1', 'ios-app', {
      usingLock: serializeUsingLock(),
      findNewest: () => store.findNewest('ios-app'),
      deleteScope: () => store.deleteScope('ios-app'),
      createToken: next => store.createToken('ios-app', next),
    });
    assert.equal(challenge, 'live-challenge');
    assert.equal(store.creates, 0);
    assert.equal(store.deletes, 0);
    assert.equal(store.tokens.length, 1);
  });

  it('replaces an expired or malformed challenge once', async () => {
    const store = createStore([
      {
        _id: 'tok-1',
        createdAt: new Date(Date.now() - BIOMETRIC_CHALLENGE_TTL_MS - 1),
        data: { clientId: 'ios-app', challenge: '' },
      },
    ]);
    const challenge = await issueOrReuseBiometricLoginChallenge('key-1', 'ios-app', {
      usingLock: serializeUsingLock(),
      findNewest: () => store.findNewest('ios-app'),
      deleteScope: () => store.deleteScope('ios-app'),
      createToken: next => store.createToken('ios-app', next),
      randomChallenge: () => 'fresh-challenge',
    });
    assert.equal(challenge, 'fresh-challenge');
    assert.equal(store.creates, 1);
    assert.equal(store.deletes, 1);
    assert.equal(store.tokens.length, 1);
    assert.equal(store.tokens[0].data.challenge, challenge);
  });

  it('returns one shared challenge for concurrent issuers of the same pair', async () => {
    const store = createStore();
    const usingLock = serializeUsingLock();
    const issue = () =>
      issueOrReuseBiometricLoginChallenge('key-1', 'ios-app', {
        usingLock,
        findNewest: () => store.findNewest('ios-app'),
        deleteScope: () => store.deleteScope('ios-app'),
        createToken: next => store.createToken('ios-app', next),
      });
    const [first, second] = await Promise.all([issue(), issue()]);
    assert.equal(first, second);
    assert.equal(store.creates, 1);
    assert.equal(store.tokens.length, 1);
    assert.equal(store.tokens[0].data.challenge, first);
  });

  it('uses a distinct lock resource per client', async () => {
    const resources: string[] = [];
    const usingLock = async <R>(
      resource: string,
      _ttl: number,
      fn: (signal: AbortSignal) => Promise<R>,
    ) => {
      resources.push(resource);
      return fn(new AbortController().signal);
    };
    await issueOrReuseBiometricLoginChallenge('key-1', 'ios-app', {
      usingLock,
      findNewest: async () => null,
      deleteScope: async () => undefined,
      createToken: async challenge => ({
        createdAt: new Date(),
        data: { clientId: 'ios-app', challenge },
      }),
    });
    await issueOrReuseBiometricLoginChallenge('key-1', 'android-app', {
      usingLock,
      findNewest: async () => null,
      deleteScope: async () => undefined,
      createToken: async challenge => ({
        createdAt: new Date(),
        data: { clientId: 'android-app', challenge },
      }),
    });
    assert.equal(resources[0], biometricChallengeLockResource('key-1', 'ios-app'));
    assert.equal(resources[1], biometricChallengeLockResource('key-1', 'android-app'));
    assert.notEqual(resources[0], resources[1]);
  });

  it('does not return a challenge after the lock lease is aborted', async () => {
    await assert.rejects(
      () =>
        issueOrReuseBiometricLoginChallenge('key-1', 'ios-app', {
          usingLock: async (_resource, _ttl, fn) => fn(AbortSignal.abort()),
          findNewest: async () => null,
          deleteScope: async () => undefined,
          createToken: async challenge => ({
            createdAt: new Date(),
            data: { clientId: 'ios-app', challenge },
          }),
        }),
      (error: unknown) =>
        error instanceof GrpcError &&
        error.code === status.UNAVAILABLE &&
        error.message === BIOMETRIC_CHALLENGE_UNAVAILABLE,
    );
  });
});
