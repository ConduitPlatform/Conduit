import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { applySocketGlobalMiddlewares } from './applySocketGlobalMiddlewares.js';

function fakeSocket(auth?: Record<string, unknown>) {
  return {
    request: {
      headers: {},
      url: '/realtime/?EIO=4&transport=polling',
    },
    handshake: { auth: auth ?? {} },
    data: {},
  };
}

describe('applySocketGlobalMiddlewares', () => {
  it('injects handshake.auth.token and copies conduit onto socket.data', async () => {
    const socket = fakeSocket({ token: 'ticket-token' });
    await applySocketGlobalMiddlewares(socket as never, [
      (req: Request, _res: Response, next: NextFunction) => {
        assert.equal(req.headers.authorization, 'Bearer ticket-token');
        (req as Request & { conduit: { admin: string } }).conduit = {
          admin: 'ok',
        };
        next();
      },
    ]);
    assert.equal((socket.data as { admin?: string }).admin, 'ok');
  });

  it('rejects when Express middleware sends 401 json', async () => {
    const socket = fakeSocket();
    await assert.rejects(
      () =>
        applySocketGlobalMiddlewares(socket as never, [
          (_req: Request, res: Response) => {
            res.status(401).json({ error: 'No token provided' });
          },
        ]),
      /No token provided/,
    );
  });
});
