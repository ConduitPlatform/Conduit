import { Application, NextFunction, Request, Response } from 'express';
import { createServer, Server as httpServer } from 'http';
import { Server as IOServer, ServerOptions, Socket } from 'socket.io';
import { createAdapter } from 'socket.io-redis';
import { RedisClient } from 'redis';
import {
  ConduitError,
  ConduitMiddleware,
  ConduitRouteParameters,
  ConduitSocket,
  EventResponse,
  isInstanceOfEventResponse,
  JoinRoomResponse,
} from '@quintessential-sft/conduit-commons';
import { isNil, isArray } from 'lodash';

export class SocketController {
  private readonly httpServer: httpServer;
  private io: IOServer;
  private readonly options: Partial<ServerOptions>;
  private _registeredNamespaces: Map<string, ConduitSocket>;
  private pubClient: RedisClient;
  private subClient: RedisClient;
  private _middlewares?: { [field: string]: ConduitMiddleware };
  private globalMiddlewares: ((
    req: Request,
    res: Response,
    next: NextFunction
  ) => void)[];

  constructor(private readonly app: Application) {
    if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
      console.error('Redis IP not defined');
      process.exit(-1);
    }

    this.httpServer = createServer(app);
    this.options = {};
    this.io = new IOServer(this.httpServer, this.options);
    this.pubClient = new RedisClient({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    });
    this.subClient = this.pubClient.duplicate();
    this.io.adapter(
      createAdapter({ pubClient: this.pubClient, subClient: this.subClient })
    );
    this.httpServer.listen(process.env.SOCKET_PORT || 3001);
    this._registeredNamespaces = new Map();
    this.globalMiddlewares = [];
  }

  registerMiddleware(middleware: ConduitMiddleware) {
    if (!this._middlewares) {
      this._middlewares = {};
    }
    this._middlewares[middleware.name] = middleware;
  }

  registerGlobalMiddleware(
    middleware: (req: Request, res: Response, next: NextFunction) => void
  ) {
    this.globalMiddlewares.push(middleware);
  }

  checkMiddlewares(params: ConduitRouteParameters, middlewares?: string[]): Promise<any> {
    let primaryPromise = new Promise((resolve, reject) => {
      resolve({});
    });
    const self = this;
    if (this._middlewares && middlewares) {
      middlewares.forEach((m) => {
        if (!this._middlewares?.hasOwnProperty(m))
          primaryPromise = Promise.reject('Middleware does not exist');
        primaryPromise = primaryPromise.then((r) => {
          return this._middlewares![m].executeRequest.bind(self._middlewares![m])(
            params
          ).then((p: any) => {
            if (p.result) {
              Object.assign(r, JSON.parse(p.result));
            }
            return r;
          });
        });
      });
    }

    return primaryPromise;
  }

  registerConduitSocket(conduitSocket: ConduitSocket) {
    const namespace = conduitSocket.input.path;
    if (this._registeredNamespaces.has(namespace)) {
      this.removeNamespace(namespace);
    }

    this._registeredNamespaces.set(namespace, conduitSocket);

    const self = this;
    this.globalMiddlewares.forEach((middleware) => {
      self.io.of(namespace).use((socket, next) => {
        // @ts-ignore
        socket.request.path = namespace;
        // @ts-ignore
        middleware(socket.request, {}, next);
      });
    });

    this.io.of(namespace).use((socket, next) => {
      const context = {
        headers: socket.request.headers,
        context: (socket.request as any).conduit || {},
      };
      self
        .checkMiddlewares(context, conduitSocket.input.middlewares)
        .then((r) => {
          Object.assign(context.context, r);
          next();
        })
        .catch((err: Error | ConduitError) => {
          next(err);
        });
    });

    this.io.of(namespace).on('connect', (socket) => {
      conduitSocket
        .executeRequest({
          event: 'connect',
          socketId: socket.id,
          // @ts-ignore
          context: socket.request.conduit,
        })
        .then((res) => {
          this.handleResponse(res, socket);
        })
        .catch((e) => {
          socket.emit('conduit_error', e);
        });

      socket.onAny((event, ...args) => {
        conduitSocket
          .executeRequest({
            event,
            socketId: socket.id,
            params: args,
            // @ts-ignore
            context: socket.request.conduit,
          })
          .then((res) => {
            this.handleResponse(res, socket);
          })
          .catch((e) => {
            socket.emit('conduit_error', e);
          });
      });

      socket.on('disconnect', () => {
        conduitSocket
          .executeRequest({
            event: 'disconnect',
            socketId: socket.id,
            // @ts-ignore
            context: socket.request.conduit,
          })
          .then((res) => {
            this.handleResponse(res, socket);
          })
          .catch((e) => {
            socket.emit('conduit_error', e);
          });
      });
    });
  }

  private handleResponse(res: EventResponse | JoinRoomResponse, socket: Socket) {
    if (isInstanceOfEventResponse(res)) {
      if (isNil(res.receivers) || res.receivers!.length === 0) {
        socket.emit(res.event, JSON.parse(res.data));
      } else {
        socket.to(res.receivers).emit(res.event, JSON.parse(res.data));
      }
    } else {
      if (res.rooms.length !== 0) {
        socket.join(res.rooms);
      }
    }
  }

  private removeNamespace(namespace: string) {
    const ns = this.io.of(namespace);
    ns.disconnectSockets(true);
    ns.removeAllListeners();
    this.io._nsps.delete(namespace);
  }
}
