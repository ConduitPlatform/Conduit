import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getConduitCode, GrpcError } from '@conduitplatform/grpc-sdk';
import { errors } from '../errors.js';
import { status } from '@grpc/grpc-js';
import {
  createGetUserHandler,
  createUserResolver,
  hiddenUserFields,
  MAX_USER_JSON_BYTES,
  sanitizeUser,
} from './userResolver.logic.js';
import { User } from '../models/index.js';
import { createFakeDatabase } from './fakeDatabase.testutil.js';
import {
  configureSessionServices,
  getUserCache,
  resetSessionServices,
} from './sessionServices.js';
import { createFakeUserCache } from './fakeSession.testutil.js';

const { table, tables, database } = createFakeDatabase();
User.getInstance(database);

const hidden = () => hiddenUserFields(User.getInstance().fields);

function setup() {
  const fake = createFakeUserCache();
  const reads: string[] = [];
  const resolve = createUserResolver({
    findUser: async id => {
      reads.push(id);
      return (await User.getInstance().findOne({ _id: id })) as any;
    },
    cache: () => fake.cache,
    hiddenFields: hidden,
  });
  return { fake, reads, resolve };
}

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  resetSessionServices();
});

describe('hiddenUserFields / sanitizeUser', () => {
  it('hides hashedPassword and every select:false field of the schema', () => {
    const fields = hidden();
    assert.ok(fields.includes('hashedPassword'));
    for (const [name, def] of Object.entries(User.getInstance().fields)) {
      if ((def as any)?.select === false) assert.ok(fields.includes(name), name);
    }
    assert.deepEqual(
      hiddenUserFields({ secret: { type: 'String', select: false }, ok: 'String' }),
      ['hashedPassword', 'secret'],
    );
  });
  it('also hides the credentials inside the provider sub-documents', () => {
    const fields = hidden();
    for (const provider of ['google', 'github', 'microsoft']) {
      assert.ok(fields.includes(`${provider}.token`), provider);
      assert.ok(fields.includes(`${provider}.tokenExpires`), provider);
    }
    assert.ok(fields.includes('metamask.nonce'));
    const clean = sanitizeUser(
      {
        _id: 'u1',
        google: { id: 'g1', token: 'oauth', tokenExpires: 1, data: { name: 'n' } },
        metamask: { ethPublicAddress: '0x1', nonce: 'n' },
      },
      fields,
    );
    assert.deepEqual(clean, {
      _id: 'u1',
      google: { id: 'g1', data: { name: 'n' } },
      metamask: { ethPublicAddress: '0x1' },
    });
  });
  it('removes them without touching the input', () => {
    const user = { _id: 'u1', email: 'a@b.c', hashedPassword: 'x', secret: 1 };
    const clean = sanitizeUser(user, ['hashedPassword', 'secret']);
    assert.deepEqual(clean, { _id: 'u1', email: 'a@b.c' });
    assert.equal(user.hashedPassword, 'x');
  });
});

describe('user resolver', () => {
  it('reads through: miss loads from the model and fills the cache', async () => {
    table('User').push({ _id: 'u1', email: 'a@b.c', active: true, hashedPassword: 'h' });
    const t = setup();
    const user = await t.resolve('u1');
    assert.equal(user.email, 'a@b.c');
    assert.equal('hashedPassword' in user, false);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(t.fake.store.has('u1'));
    assert.equal('hashedPassword' in t.fake.store.get('u1')!, false);
    // hit: no second read
    await t.resolve('u1');
    assert.equal(t.reads.length, 1);
  });
  it('strips hidden fields from a poisoned cache entry', async () => {
    const t = setup();
    t.fake.store.set('u9', { _id: 'u9', hashedPassword: 'leak', active: true });
    const user = await t.resolve('u9');
    assert.equal('hashedPassword' in user, false);
  });
  it('unknown id is NOT_FOUND and is not cached', async () => {
    const t = setup();
    await assert.rejects(
      t.resolve('missing'),
      e =>
        e instanceof GrpcError &&
        e.code === status.NOT_FOUND &&
        getConduitCode(e) === errors.USER_NOT_FOUND.conduitCode,
    );
    assert.equal(t.fake.store.size, 0);
  });
  it('an empty id is INVALID_ARGUMENT', async () => {
    const t = setup();
    await assert.rejects(
      t.resolve(''),
      e =>
        e instanceof GrpcError &&
        e.code === status.INVALID_ARGUMENT &&
        getConduitCode(e) === errors.USER_ID_INVALID.conduitCode,
    );
  });
  it('works without a cache', async () => {
    table('User').push({ _id: 'u1', active: true });
    const resolve = createUserResolver({
      findUser: async id => (await User.getInstance().findOne({ _id: id })) as any,
      cache: () => undefined,
      hiddenFields: hidden,
    });
    assert.equal((await resolve('u1'))._id, 'u1');
  });
  it('survives a throwing cache provider', async () => {
    table('User').push({ _id: 'u1', active: true });
    const resolve = createUserResolver({
      findUser: async id => (await User.getInstance().findOne({ _id: id })) as any,
      cache: () => {
        throw new Error('redis not initialized');
      },
      hiddenFields: hidden,
    });
    assert.equal((await resolve('u1'))._id, 'u1');
  });
});

describe('GetUser rpc handler', () => {
  async function call(userId: string) {
    table('User').push({ _id: 'u1', email: 'a@b.c', active: true, hashedPassword: 'h' });
    const t = setup();
    const handler = createGetUserHandler(t.resolve);
    return new Promise<{ error: any; response: any }>(resolve => {
      void handler({ request: { userId } }, (error, response) =>
        resolve({ error, response }),
      );
    });
  }
  it('returns the user JSON without the password hash', async () => {
    const { error, response } = await call('u1');
    assert.equal(error, null);
    const user = JSON.parse(response.user);
    assert.equal(user.email, 'a@b.c');
    assert.equal(user.hashedPassword, undefined);
  });
  it('answers NOT_FOUND for an unknown id', async () => {
    const { error, response } = await call('nope');
    assert.equal(error.code, status.NOT_FOUND);
    assert.equal(response, undefined);
  });
  it('refuses to serialize a user over 1 MB', async () => {
    const handler = createGetUserHandler(async () => ({
      _id: 'u1',
      blob: 'x'.repeat(MAX_USER_JSON_BYTES + 1),
    }));
    const result = await new Promise<any>(resolve => {
      void handler({ request: { userId: 'u1' } }, (error, response) =>
        resolve({ error, response }),
      );
    });
    assert.equal(result.error.code, status.INTERNAL);
    assert.equal(
      getConduitCode(result.error),
      errors.USER_DOCUMENT_TOO_LARGE.conduitCode,
    );
    assert.equal(result.response, undefined);
  });
  it('maps unexpected errors to INTERNAL', async () => {
    const handler = createGetUserHandler(async () => {
      throw new Error('db down');
    });
    const result = await new Promise<any>(resolve => {
      void handler({ request: { userId: 'u1' } }, error => resolve(error));
    });
    assert.equal(result.code, status.INTERNAL);
  });
});

describe('User model cache invalidation', () => {
  function withCache() {
    const fake = createFakeUserCache();
    configureSessionServices({ userCache: () => fake.cache });
    assert.ok(getUserCache());
    return fake;
  }
  it('an _id filter names the ids: no pre-read', async () => {
    table('User').push({ _id: 'u1' }, { _id: 'u2' });
    const fake = withCache();
    const model = User.getInstance();
    const original = model.findMany.bind(model);
    let reads = 0;
    model.findMany = (async (...args: Parameters<typeof original>) => {
      reads += 1;
      return original(...args);
    }) as typeof model.findMany;
    try {
      await model.updateOne({ _id: 'u1' }, { active: false });
      await model.updateMany({ _id: { $in: ['u1', 'u2'] } } as any, { active: false });
    } finally {
      model.findMany = original;
    }
    assert.equal(reads, 0);
    assert.deepEqual(fake.invalidated, ['u1', 'u1', 'u2']);
  });
  it('without a cache there is no pre-read either', async () => {
    table('User').push({ _id: 'u1', homeRealm: null });
    const model = User.getInstance();
    const original = model.findMany.bind(model);
    let reads = 0;
    model.findMany = (async (...args: Parameters<typeof original>) => {
      reads += 1;
      return original(...args);
    }) as typeof model.findMany;
    try {
      await model.updateMany({ homeRealm: null } as any, { homeRealm: 'r1' });
    } finally {
      model.findMany = original;
    }
    assert.equal(reads, 0);
    assert.equal(table('User')[0].homeRealm, 'r1');
  });
  it('a failing pre-read never blocks the write', async () => {
    table('User').push({ _id: 'u1', homeRealm: null });
    const fake = withCache();
    const model = User.getInstance();
    const original = model.findMany.bind(model);
    model.findMany = (async () => {
      throw new Error('db down');
    }) as typeof model.findMany;
    try {
      await model.updateMany({ homeRealm: null } as any, { homeRealm: 'r1' });
    } finally {
      model.findMany = original;
    }
    assert.equal(table('User')[0].homeRealm, 'r1');
    assert.deepEqual(fake.invalidated, []);
  });
  it('findByIdAndUpdate invalidates the user', async () => {
    table('User').push({ _id: 'u1', active: true });
    const fake = withCache();
    await User.getInstance().findByIdAndUpdate('u1', { active: false });
    assert.deepEqual(fake.invalidated, ['u1']);
  });
  it('updateMany reads the affected ids first (the filter may stop matching)', async () => {
    table('User').push(
      { _id: 'u1', homeRealm: null },
      { _id: 'u2', homeRealm: null },
      { _id: 'u3', homeRealm: 'r9' },
    );
    const fake = withCache();
    await User.getInstance().updateMany({ homeRealm: null } as any, { homeRealm: 'r1' });
    assert.deepEqual(fake.invalidated.sort(), ['u1', 'u2']);
  });
  it('deleteOne and deleteMany invalidate the deleted users', async () => {
    table('User').push({ _id: 'u1' }, { _id: 'u2' }, { _id: 'u3' });
    const fake = withCache();
    await User.getInstance().deleteOne({ _id: 'u1' });
    await User.getInstance().deleteMany({ _id: { $in: ['u2', 'u3'] } } as any);
    assert.deepEqual(fake.invalidated, ['u1', 'u2', 'u3']);
    assert.equal(table('User').length, 0);
  });
  it('writes work without a cache', async () => {
    table('User').push({ _id: 'u1', active: true });
    await User.getInstance().findByIdAndUpdate('u1', { active: false });
    assert.equal(table('User')[0].active, false);
  });
  it('a failing cache never fails the write', async () => {
    table('User').push({ _id: 'u1', active: true });
    configureSessionServices({
      userCache: () =>
        ({
          invalidateMany: async () => {
            throw new Error('redis down');
          },
        }) as any,
    });
    await User.getInstance().findByIdAndUpdate('u1', { active: false });
    assert.equal(table('User')[0].active, false);
  });
});
