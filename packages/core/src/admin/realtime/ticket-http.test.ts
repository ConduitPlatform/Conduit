import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { ConfigController } from '@conduitplatform/module-tools';
import { isSocketHandshake } from '@conduitplatform/hermes';
import { getAuthMiddleware } from '../middleware/Auth.middleware.js';
import {
  buildRealtimeTicketClaims,
  isRealtimeTicket,
  realtimeTicketForbiddenOnHttp,
} from './ticket.js';

function mockResponse() {
  let statusCode = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };
  return {
    res,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

describe('realtime ticket HTTP guard', () => {
  it('does not treat POST /realtime/ticket as a handshake so a ticket cannot mint another', () => {
    const ticket = buildRealtimeTicketClaims('admin-1');
    assert.equal(isRealtimeTicket(ticket), true);
    assert.equal(isSocketHandshake({ url: '/realtime/ticket' }), false);
    assert.equal(
      isSocketHandshake({ url: '/realtime/ticket?EIO=4&transport=polling' }),
      false,
    );
    assert.equal(
      realtimeTicketForbiddenOnHttp(ticket, { url: '/realtime/ticket' }),
      true,
    );
    assert.equal(
      realtimeTicketForbiddenOnHttp(ticket, {
        url: '/realtime/ticket?EIO=4&transport=polling',
      }),
      true,
    );
  });

  it('allows a ticket on Engine.IO handshake polling without sid', () => {
    const ticket = buildRealtimeTicketClaims('admin-1');
    const handshake = { url: '/realtime/?EIO=4&transport=polling' };
    assert.equal(isSocketHandshake(handshake), true);
    assert.equal(realtimeTicketForbiddenOnHttp(ticket, handshake), false);
  });

  it('Auth middleware returns 401 on POST /realtime/ticket with a realtime ticket', async () => {
    const secret = 'ticket-http-test-secret';
    ConfigController.getInstance().config = { auth: { tokenSecret: secret } };
    const token = jwt.sign(buildRealtimeTicketClaims('admin-1'), secret, {
      algorithm: 'HS256',
      expiresIn: 30,
    });
    const middleware = getAuthMiddleware({} as never, {
      get: async () => ({ env: 'production' }),
    });
    const mock = mockResponse();
    let nextCalled = false;
    await middleware(
      {
        path: '/realtime/ticket',
        originalUrl: '/realtime/ticket',
        url: '/realtime/ticket',
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        conduit: {},
      } as never,
      mock.res as never,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, false);
    assert.equal(mock.statusCode, 401);
    assert.deepEqual(mock.body, {
      error: 'Realtime ticket cannot be used for HTTP requests',
    });
  });
});
