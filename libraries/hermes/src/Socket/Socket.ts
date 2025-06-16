import { Application, NextFunction, Request, Response } from 'express';
import { createServer, Server as httpServer } from 'http';
import { RemoteSocket, Server as IOServer, ServerOptions, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Cluster, Redis } from 'ioredis';
import { ConduitRouter } from '../Router.js';
import { isNil } from 'lodash-es';
import {
  ConduitSocket,
  EventResponse,
  isInstanceOfEventResponse,
  JoinRoomResponse,
  SocketPush,
} from '../interfaces/index.js';
import ObjectHash from 'object-hash';
import { ConduitError, ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

export class SocketController extends ConduitRouter {
  private readonly httpServer: httpServer;
  private io: IOServer;
  private readonly options: Partial<ServerOptions>;
  private _registeredNamespaces: Map<string, ConduitSocket>;
  private readonly pubClient: Redis | Cluster;
  private readonly subClient: Redis | Cluster;
  private globalMiddlewares: ((
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void)[];

  constructor(
    private readonly port: number,
    grpcSdk: ConduitGrpcSdk,
    expressApp: Application,
    private readonly metrics?: {
      registeredRoutes?: {
        name: string;
      };
    },
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
    this.pubClient = grpcSdk.redisManager.getClient();
    this.subClient = this.pubClient.duplicate();
    this.io.adapter(createAdapter(this.pubClient, this.subClient));
    this.httpServer.listen(this.port);
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
        ObjectHash.sha1(this._registeredNamespaces.get(namespace)!)
      ) {
        this.removeNamespace(namespace);
        if (this.metrics?.registeredRoutes) {
          ConduitGrpcSdk.Metrics?.increment(this.metrics.registeredRoutes.name, 1, {
            transport: 'socket',
          });
        }
      } else {
        return;
      }
    }

    this._registeredNamespaces.set(namespace, conduitSocket);

    const self = this;
    this.globalMiddlewares.forEach(middleware => {
      self.io.engine.use((req: any, res: any, next: any) => {
        req.path = namespace;
        middleware(req, res, next);
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
          if (context.context) {
            socket.data = context.context;
          }
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
        .then(res => this.handleResponse(res, socket, namespace))
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
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
          .then(res => this.handleResponse(res, socket, namespace))
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
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
          .then(res => this.handleResponse(res, socket, namespace))
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
            socket.emit('conduit_error', e);
          });
      });
    });
  }

  async handleSocketPush(push: SocketPush) {
    if (push.event === 'join-room') {
      if (push.rooms.length === 0) return;
      const filteredSockets = await this.findAndFilterSockets(
        push.receivers,
        push.namespace,
      );
      for (const socket of filteredSockets) {
        socket.join(push.rooms);
      }
    } else if (push.event === 'leave-room') {
      if (push.rooms && push.rooms.length !== 0) {
        const filteredSockets = await this.findAndFilterSockets(
          push.receivers,
          push.namespace,
        );
        for (const socket of filteredSockets) {
          for (const room of push.rooms) {
            socket.leave(room);
          }
        }
      }
    } else if (isInstanceOfEventResponse(push)) {
      if (isNil(push.receivers) || push.receivers!.length === 0) {
        this.io.of(push.namespace).emit(push.event, JSON.parse(push.data));
      } else {
        if (push.rooms.length !== 0) {
          this.io.of(push.namespace).to(push.rooms).emit(push.event, JSON.parse(push.data));
        }
        if (push.receivers.length !== 0) {
          const filteredSockets = await this.findAndFilterSockets(
            push.receivers,
            push.namespace,
          );
          for (const socket of filteredSockets) {
            socket.emit(push.event, JSON.parse(push.data));
          }
        }
      }
    }
  }

  private async handleResponse(
    res: EventResponse | JoinRoomResponse,
    socket: Socket,
    namespace: string,
  ) {
    if (res.event === 'join-room') {
      if (res.rooms && res.rooms.length !== 0) {
        socket.join(res.rooms);
      }
    } else if (res.event === 'leave-room') {
      if (res.rooms && res.rooms.length !== 0) {
        for (const room of res.rooms) {
          socket.leave(room);
        }
      }
    } else if (isInstanceOfEventResponse(res)) {
      if (
        (!res.receivers || res.receivers.length === 0) &&
        (!res.rooms || res.rooms.length === 0)
      ) {
        socket.emit(res.event, JSON.parse(res.data));
      } else {
        if (res.rooms && res.rooms.length !== 0) {
          this.io.of(namespace).to(res.rooms).emit(res.event, JSON.parse(res.data));
        }
        if (res.receivers && res.receivers.length !== 0) {
          const filteredSockets = await this.findAndFilterSockets(
            res.receivers,
            namespace,
          );
          for (const socket of filteredSockets) {
            socket.emit(res.event, JSON.parse(res.data));
          }
        }
      }
    }
  }

  async findAndFilterSockets(
    userIds: string[],
    namespace: string,
  ): Promise<RemoteSocket<any, any>[]> {
    const sockets = await this.io.in(namespace).fetchSockets();
    return sockets.filter(socket => {
      if (socket.data && socket.data.user) {
        return userIds.includes(socket.data.user._id);
      }
    });
  }

  protected _refreshRouter(): void {
    throw new Error('Method not implemented.');
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
    this.pubClient.quit();
    this.subClient.quit();
  }
}
