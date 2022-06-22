import { Application, NextFunction, Request, Response } from 'express';
import { createServer, Server as httpServer } from 'http';
import { Server as IOServer, ServerOptions, Socket } from 'socket.io';
import { createAdapter } from 'socket.io-redis';
import { RedisClient } from 'redis';
import { ConduitRouter } from '../Router';
import { isNil } from 'lodash';
import {
  ConduitSocket,
  EventResponse,
  isInstanceOfEventResponse,
  JoinRoomResponse,
  SocketPush,
} from '../interfaces';
import ObjectHash from 'object-hash';
import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/grpc-sdk';

export class SocketController extends ConduitRouter {
  private readonly httpServer: httpServer;
  private io: IOServer;
  private readonly options: Partial<ServerOptions>;
  private _registeredNamespaces: Map<string, ConduitSocket>;
  private readonly pubClient: RedisClient;
  private readonly subClient: RedisClient;
  private globalMiddlewares: ((
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void)[];

  constructor(
    private readonly port: number,
    grpcSdk: ConduitGrpcSdk,
    expressApp: Application,
    redisDetails: { host: string; port: number },
  ) {
    super(grpcSdk);
    this.httpServer = createServer(expressApp);
    this.options = {
      path: '/realtime',
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    };
    this.io = new IOServer(this.httpServer, this.options);
    this.pubClient = new RedisClient({
      host: redisDetails.host,
      port: redisDetails.port,
    });
    this.subClient = this.pubClient.duplicate();
    this.io.adapter(
      createAdapter({ pubClient: this.pubClient, subClient: this.subClient }),
    );
    this.httpServer.listen(process.env.SOCKET_PORT || this.port);
    this._registeredNamespaces = new Map();
    this.globalMiddlewares = [];
  }

  registerGlobalMiddleware(
    middleware: (req: Request, res: Response, next: NextFunction) => void,
  ) {
    this.globalMiddlewares.push(middleware);
  }

  registerConduitSocket(conduitSocket: ConduitSocket) {
    const namespace = conduitSocket.input.path;
    if (this._registeredNamespaces.has(namespace)) {
      if (
        ObjectHash.sha1(conduitSocket) !==
        ObjectHash.sha1(this._registeredRoutes.get(namespace))
      ) {
        this.removeNamespace(namespace);
      } else {
        return;
      }
    }

    this._registeredNamespaces.set(namespace, conduitSocket);

    const self = this;
    this.globalMiddlewares.forEach(middleware => {
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
        .then(r => {
          Object.assign(context.context, r);
          next();
        })
        .catch((err: Error | ConduitError) => {
          next(err);
        });
    });

    this.io.of(namespace).on('connect', socket => {
      conduitSocket
        .executeRequest({
          event: 'connect',
          socketId: socket.id,
          // @ts-ignore
          context: socket.request.conduit,
        })
        .then(res => {
          this.handleResponse(res, socket);
        })
        .catch(e => {
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
          .then(res => {
            this.handleResponse(res, socket);
          })
          .catch(e => {
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
          .then(res => {
            this.handleResponse(res, socket);
          })
          .catch(e => {
            socket.emit('conduit_error', e);
          });
      });
    });
  }

  handleSocketPush(push: SocketPush) {
    if (isInstanceOfEventResponse(push)) {
      if (isNil(push.receivers) || push.receivers!.length === 0) {
        this.io.of(push.namespace).emit(push.event, push.data);
      } else {
        this.io.of(push.namespace).to(push.receivers).emit(push.event, push.data);
      }
    } else {
      throw new Error('Cannot join room in this context');
    }
  }

  protected _refreshRouter(): void {
    throw new Error('Method not implemented.');
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

  shutDown() {
    super.shutDown();
    this.io.close();
    this.httpServer.close();
    this.pubClient.end(false);
    this.subClient.end(false);
  }
}
