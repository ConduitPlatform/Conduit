import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConduitGrpcSdk,
  GrpcError,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { LocalHandlers } from './local.js';
import { issuePasswordReset } from './local.logic.js';
import { Token, User } from '../models/index.js';
import { TokenType } from '../constants/index.js';
import { createFakeDatabase, Doc } from '../utils/fakeDatabase.testutil.js';

const { table, tables, database } = createFakeDatabase();
Token.getInstance(database);
User.getInstance(database);

const emails: { template: string; params: Doc }[] = [];
let emailAvailable = true;
const grpcSdk = {
  isAvailable: (name: string) => name === 'email' && emailAvailable,
  emailProvider: {
    sendEmail: async (template: string, params: Doc) => {
      emails.push({ template, params });
    },
  },
} as unknown as ConduitGrpcSdk;

const handlers = new LocalHandlers(grpcSdk);

function codeOf(error: unknown) {
  return error instanceof GrpcError ? error.code : undefined;
}

function call(params: Doc, bodyParams: Doc = params): ParsedRouterRequest {
  return { request: { params, bodyParams } } as ParsedRouterRequest;
}

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  emails.length = 0;
  emailAvailable = true;
  ConfigController.getInstance().config = {
    local: {
      enabled: true,
      forgot_password_redirect_uri: 'https://app.example/reset',
      verification: { resend_threshold: 60_000 },
    },
    redirectUris: { allowAny: true, whitelistedUris: [] },
    teams: { enabled: false },
  };
});

describe('issuePasswordReset', () => {
  const user = {
    _id: 'user-1',
    email: 'ada@example.com',
    hashedPassword: 'hashed',
    isAnonymous: false,
  } as User;

  it('creates a reset token and emails a link that contains it', async () => {
    await issuePasswordReset(grpcSdk, user, 'https://app.example/reset');
    const token = table('Token')[0];
    assert.equal(token.tokenType, TokenType.PASSWORD_RESET_TOKEN);
    assert.equal(token.user, 'user-1');
    assert.equal(emails.length, 1);
    assert.equal(emails[0].template, 'ForgotPassword');
    assert.equal(emails[0].params.email, 'ada@example.com');
    assert.equal(
      emails[0].params.variables.link,
      `https://app.example/reset?reset_token=${token.token}`,
    );
    assert.equal(emails[0].params.variables.user.hashedPassword, undefined);
  });

  it('refuses anonymous users, users without a password and users without an email', async () => {
    await assert.rejects(
      issuePasswordReset(grpcSdk, { ...user, isAnonymous: true } as User, 'https://app'),
      error => codeOf(error) === status.PERMISSION_DENIED,
    );
    await assert.rejects(
      issuePasswordReset(
        grpcSdk,
        { ...user, hashedPassword: undefined } as User,
        'https://app',
      ),
      error => codeOf(error) === status.PERMISSION_DENIED,
    );
    await assert.rejects(
      issuePasswordReset(
        grpcSdk,
        { ...user, email: undefined } as unknown as User,
        'https://app',
      ),
      error => codeOf(error) === status.FAILED_PRECONDITION,
    );
    assert.equal(table('Token').length, 0);
    assert.equal(emails.length, 0);
  });

  it('keeps the resend threshold and replaces an old token once it has passed', async () => {
    table('Token').push({
      _id: 'old',
      user: 'user-1',
      tokenType: TokenType.PASSWORD_RESET_TOKEN,
      token: 'old-token',
      createdAt: new Date(),
    });
    await assert.rejects(
      issuePasswordReset(grpcSdk, user, 'https://app.example/reset'),
      error => codeOf(error) === status.RESOURCE_EXHAUSTED,
    );
    assert.equal(table('Token').length, 1);
    table('Token')[0].createdAt = new Date(Date.now() - 120_000);
    await issuePasswordReset(grpcSdk, user, 'https://app.example/reset');
    assert.equal(table('Token').length, 1);
    assert.notEqual(table('Token')[0].token, 'old-token');
  });
});

describe('forgotPassword', () => {
  it('still answers with the same message and sends a reset link', async () => {
    table('User').push({
      _id: 'user-1',
      email: 'ada@example.com',
      hashedPassword: 'hashed',
      active: true,
    });
    const result = await handlers.forgotPassword(call({ email: 'Ada@example.com' }, {}));
    assert.equal(
      result,
      'If the email address is valid, a password reset link will be sent to it.',
    );
    assert.equal(table('Token').length, 1);
    assert.equal(table('Token')[0].tokenType, TokenType.PASSWORD_RESET_TOKEN);
    assert.match(emails[0].params.variables.link, /reset_token=/);
    assert.match(emails[0].params.variables.link, /^https:\/\/app\.example\/reset\?/);

    emails.length = 0;
    const missing = await handlers.forgotPassword(call({ email: 'missing@example.com' }));
    assert.equal(missing, result);
    assert.equal(table('Token').length, 1);
    assert.equal(emails.length, 0);
  });
});
