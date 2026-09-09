import type { NextFunction, Request, Response } from 'express';
import type { Socket } from 'socket.io';
import { buildSocketMiddlewareParams } from './buildSocketMiddlewareParams.js';

type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void;

type ConduitRequest = Request & { conduit?: Record<string, unknown> };

export async function applySocketGlobalMiddlewares(
  socket: Socket,
  middlewares: ExpressMiddleware[],
): Promise<void> {
  const params = buildSocketMiddlewareParams(socket);
  const req = Object.assign(socket.request, {
    headers: params.headers,
    path: '/realtime',
    url: socket.request.url ?? '/realtime',
    originalUrl: socket.request.url ?? '/realtime',
    conduit: { ...params.context },
  }) as ConduitRequest;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const res = {
      statusCode: 200,
      status(this: { statusCode: number }, code: number) {
        this.statusCode = code;
        return this;
      },
      json(this: unknown, body: { error?: string }) {
        if (settled) return this;
        settled = true;
        reject(new Error(body?.error || 'Unauthorized'));
        return this;
      },
      setHeader() {
        return this;
      },
      removeHeader() {},
    } as unknown as Response;

    let index = 0;
    const next = (err?: unknown) => {
      if (settled) return;
      if (err) {
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      const middleware = middlewares[index++];
      if (!middleware) {
        settled = true;
        socket.data = { ...socket.data, ...(req.conduit ?? {}) };
        resolve();
        return;
      }
      try {
        middleware(req, res, next);
      } catch (error) {
        settled = true;
        reject(error as Error);
      }
    };
    next();
  });
}
