import { describe, it } from 'node:test';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import assert from 'node:assert/strict';
import { shouldHydrateUser, hydrateContextUser } from '../../dist/index.esm.js';

const req = { middlewares: ['authMiddleware'] };
const opt = { middlewares: ['authMiddleware?'] };

describe('shouldHydrateUser', () => {
  it('hydrates authMiddleware and authMiddleware? routes with userId and no user', () => {
    assert.equal(shouldHydrateUser(req, { userId: 'u1' }), true);
    assert.equal(shouldHydrateUser(opt, { userId: 'u1' }), true);
    assert.equal(
      shouldHydrateUser({ middlewares: ['x', 'authMiddleware'] }, { userId: 'u1' }),
      true,
    );
  });
  it('skips when user already set (session mode)', () => {
    assert.equal(shouldHydrateUser(req, { userId: 'u1', user: { _id: 'u1' } }), false);
  });
  it('skips without userId', () => {
    assert.equal(shouldHydrateUser(req, {}), false);
    assert.equal(shouldHydrateUser(req, undefined), false);
  });
  it('skips routes without auth middleware', () => {
    assert.equal(shouldHydrateUser({ middlewares: [] }, { userId: 'u1' }), false);
    assert.equal(shouldHydrateUser({ middlewares: ['other'] }, { userId: 'u1' }), false);
    assert.equal(shouldHydrateUser({}, { userId: 'u1' }), false);
  });
  it('honours hydrateUser: false but not true/undefined', () => {
    assert.equal(
      shouldHydrateUser({ ...req, hydrateUser: false }, { userId: 'u1' }),
      false,
    );
    assert.equal(
      shouldHydrateUser({ ...req, hydrateUser: true }, { userId: 'u1' }),
      true,
    );
  });
});

describe('hydrateContextUser', () => {
  it('sets context.user', async () => {
    const ctx: any = { userId: 'u1' };
    await hydrateContextUser(req, ctx, {
      optional: false,
      getUser: async id => ({ _id: id }),
    });
    assert.deepEqual(ctx.user, { _id: 'u1' });
  });
  it('throws UNAUTHENTICATED for mandatory failures', async () => {
    const ctx: any = { userId: 'u1' };
    await assert.rejects(
      hydrateContextUser(req, ctx, {
        optional: false,
        getUser: async () => {
          throw new GrpcError(5, 'x');
        },
      }),
      (e: any) => e.code === 16,
    );
    assert.equal(ctx.user, undefined);
  });
  it('leaves context untouched for optional failures', async () => {
    const ctx: any = { userId: 'u1' };
    await hydrateContextUser(opt, ctx, {
      optional: true,
      getUser: async () => {
        throw new Error('x');
      },
    });
    assert.deepEqual(ctx, { userId: 'u1' });
  });
});
