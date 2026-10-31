import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk, DatabaseProvider, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { MagicLinkHandlers } from './magicLink.js';
import { TokenProvider } from './tokenProvider.js';
import { Token, User } from '../models/index.js';
import { TokenType } from '../constants/index.js';
import { MAGIC_LINK_TTL_MS } from '../config/magicLink.config.js';

type Doc = Record<string, any>;

function matches(doc: Doc, query: Doc): boolean {
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$or') return (condition as Doc[]).some(q => matches(doc, q));
    const value = doc[key];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      return Object.entries(condition).every(([op, arg]) => {
        switch (op) {
          case '$ne':
            return value !== arg;
          case '$lt':
            return value < (arg as Date);
          case '$lte':
            return value <= (arg as Date);
          case '$exists':
            return (value !== undefined) === arg;
          default:
            throw new Error(`unsupported operator ${op}`);
        }
      });
    }
    return value === condition;
  });
}

function createDatabase() {
  const tables: Record<string, Doc[]> = { Token: [], User: [] };
  let nextId = 0;
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const table = (name: string) => (tables[name] ??= []);
  const database = {
    async findOne(name: string, query: Doc) {
      await tick();
      return table(name).find(doc => matches(doc, query)) ?? null;
    },
    async create(name: string, doc: Doc) {
      await tick();
      nextId += 1;
      const now = new Date(1_600_000_000_000 + nextId);
      const row = { _id: `${name}-${nextId}`, createdAt: now, updatedAt: now, ...doc };
      table(name).push(row);
      return row;
    },
    async deleteOne(name: string, query: Doc) {
      await tick();
      const index = table(name).findIndex(doc => matches(doc, query));
      if (index < 0) return { deletedCount: 0 };
      table(name).splice(index, 1);
      return { deletedCount: 1 };
    },
    async deleteMany(name: string, query: Doc) {
      await tick();
      const before = table(name).length;
      tables[name] = table(name).filter(doc => !matches(doc, query));
      return { deletedCount: before - tables[name].length };
    },
  };
  return { tables, database: database as unknown as DatabaseProvider };
}

const { tables, database } = createDatabase();
Token.getInstance(database);
User.getInstance(database);

const sessions: { userId: string; clientId: string; redirectUri?: string }[] = [];
let failSession = false;
(TokenProvider as unknown as { getInstance: () => unknown }).getInstance = () => ({
  provideUserTokens: async (
    options: { user: { _id: string }; clientId: string },
    redirectUri?: string,
  ) => {
    if (failSession) throw new Error('session failed');
    sessions.push({ userId: options.user._id, clientId: options.clientId, redirectUri });
    return { accessToken: 'access', refreshToken: 'refresh' };
  },
});

const sentLinks: string[] = [];
let failMail = false;
function createHandlers() {
  const grpcSdk = {
    config: { get: async () => ({ hostUrl: 'https://api.example.com' }) },
  } as unknown as ConduitGrpcSdk;
  const handlers = new MagicLinkHandlers(grpcSdk);
  (handlers as unknown as { emailModule: unknown }).emailModule = {
    sendEmail: async (_template: string, params: { variables: { link: string } }) => {
      if (failMail) throw new Error('mail down');
      sentLinks.push(params.variables.link);
    },
  };
  return handlers;
}

function sendCall(email: string) {
  return {
    request: {
      params: { email },
      bodyParams: {},
      context: { clientId: 'web' },
    },
  } as any;
}

function redeemCall(token: string) {
  return {
    request: { urlParams: { verificationToken: token, magicToken: token }, params: {} },
  } as any;
}

function verify(handlers: MagicLinkHandlers, token: string) {
  return handlers.verifyLogin(redeemCall(token));
}

function exchange(handlers: MagicLinkHandlers, token: string) {
  return (
    handlers as unknown as { exchangeMagicToken: (call: unknown) => Promise<unknown> }
  ).exchangeMagicToken(redeemCall(token));
}

const magicLinks = () => tables.Token.filter(t => t.tokenType === TokenType.MAGIC_LINK);
const notFound = (err: unknown) =>
  err instanceof GrpcError && err.code === status.NOT_FOUND;

describe('MagicLinkHandlers', () => {
  beforeEach(() => {
    ConfigController.getInstance().config = {
      magic_link: {
        enabled: true,
        redirect_uri: 'https://app.example.com/',
        link_uri: '',
        expiry_period: MAGIC_LINK_TTL_MS,
      },
    };
    tables.Token = [];
    tables.User = [{ _id: 'user-1', email: 'user@example.com', isAnonymous: false }];
    sessions.length = 0;
    sentLinks.length = 0;
    failSession = false;
    failMail = false;
  });

  afterEach(() => {
    tables.Token = [];
  });

  it('issues an expiring token, mails the hook link and redeems it once', async () => {
    const handlers = createHandlers();
    const before = Date.now();
    assert.equal(
      await handlers.sendMagicLink(sendCall('User@Example.com')),
      'token sent',
    );
    const [token] = magicLinks();
    assert.equal(token.user, 'user-1');
    assert.ok(token.expiresAt.getTime() >= before + MAGIC_LINK_TTL_MS);
    assert.ok(token.expiresAt.getTime() <= Date.now() + MAGIC_LINK_TTL_MS);
    assert.deepEqual(sentLinks, [
      `https://api.example.com/hook/authentication/magic-link/${token.token}`,
    ]);

    await verify(handlers, token.token);
    assert.deepEqual(sessions, [
      { userId: 'user-1', clientId: 'web', redirectUri: 'https://app.example.com' },
    ]);
    assert.equal(magicLinks().length, 0);
    await assert.rejects(() => exchange(handlers, token.token), notFound);
  });

  it('lets one of a concurrent hook and exchange redeem succeed', async () => {
    const handlers = createHandlers();
    await handlers.sendMagicLink(sendCall('user@example.com'));
    const [token] = magicLinks();
    const results = await Promise.allSettled([
      verify(handlers, token.token),
      exchange(handlers, token.token),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(sessions.length, 1);
  });

  it('replaces the previous link with a new one', async () => {
    const handlers = createHandlers();
    await handlers.sendMagicLink(sendCall('user@example.com'));
    const [first] = magicLinks();
    await handlers.sendMagicLink(sendCall('user@example.com'));
    const [second] = magicLinks();
    assert.equal(magicLinks().length, 1);
    assert.notEqual(first.token, second.token);
    await assert.rejects(() => verify(handlers, first.token), notFound);
    await verify(handlers, second.token);
    assert.equal(sessions.length, 1);
  });

  it('keeps exactly the newest link after concurrent requests', async () => {
    const handlers = createHandlers();
    await Promise.all([
      handlers.sendMagicLink(sendCall('user@example.com')),
      handlers.sendMagicLink(sendCall('user@example.com')),
    ]);
    assert.equal(magicLinks().length, 1);
    assert.equal(sentLinks.length, 2);
    assert.ok(sentLinks[1].endsWith(magicLinks()[0].token));
  });

  it('keeps the previous link when the new mail cannot be sent', async () => {
    const handlers = createHandlers();
    await handlers.sendMagicLink(sendCall('user@example.com'));
    const [first] = magicLinks();
    failMail = true;
    await assert.rejects(() => handlers.sendMagicLink(sendCall('user@example.com')));
    failMail = false;
    await verify(handlers, first.token);
    assert.equal(sessions.length, 1);
  });

  it('burns the token when the session cannot be issued', async () => {
    const handlers = createHandlers();
    await handlers.sendMagicLink(sendCall('user@example.com'));
    const [token] = magicLinks();
    failSession = true;
    await assert.rejects(() => exchange(handlers, token.token), /session failed/);
    failSession = false;
    assert.equal(magicLinks().length, 0);
    await assert.rejects(() => verify(handlers, token.token), notFound);
    assert.equal(sessions.length, 0);
  });

  it('refuses an expired token the TTL monitor has not removed yet', async () => {
    const handlers = createHandlers();
    await handlers.sendMagicLink(sendCall('user@example.com'));
    const [token] = magicLinks();
    token.expiresAt = new Date(Date.now() - 1);
    await assert.rejects(() => verify(handlers, token.token), notFound);
    assert.equal(sessions.length, 0);
  });
});
