import { Application, NextFunction, Request, Response } from 'express';
import { createServer, Server as httpServer } from 'http';
import { RemoteSocket, Server as IOServer, ServerOptions, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-streams-adapter';
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
  private readonly redisClient: Redis | Cluster;
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
      connectionStateRecovery: {
        // the backup duration of the sessions and the packets
        maxDisconnectionDuration: 2 * 60 * 1000,
        // whether to skip middlewares upon successful recovery
        skipMiddlewares: false,
      },
    };
    this.io = new IOServer(this.httpServer, this.options);
    this.redisClient = grpcSdk.redisManager.getClient();
    this.io.adapter(
      createAdapter(this.redisClient, {
        onlyPlaintext: true,
      }),
    );
    this.httpServer.listen(this.port);
    this._registeredNamespaces = new Map();
    this.globalMiddlewares = [];

    this.io.engine.on('connection_error', err => {
      ConduitGrpcSdk.Logger.error(
        `Socket connection error, code: ${err?.code ?? 'N/A'}, message: ${err.message}`,
      );

      ConduitGrpcSdk.Logger.error(
        `Socket connection error, request: ${err?.req ?? 'N/A'}`,
      );
      ConduitGrpcSdk.Logger.error(
        `Socket connection error, context: ${err?.context ?? 'N/A'}`,
      );
    });
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
          Object.assign(context.context, r);
          socket.data = context.context;
          next();
        })
        .catch((err: Error | ConduitError) => {
          next(err);
        });
    });

    this.io.of(namespace).on('connect', socket => {
      if (socket.recovered) {
        ConduitGrpcSdk.Logger.info(
          `Socket recovered: ${socket.id} to namespace: ${namespace}`,
        );
      } else {
        ConduitGrpcSdk.Logger.info(
          `Socket connected: ${socket.id} to namespace: ${namespace}`,
        );
        conduitSocket
          .executeRequest({
            event: 'connect',
            socketId: socket.id,
            context: socket.data,
          })
          .then(res => this.handleResponse(res, socket, namespace))
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
            socket.emit('conduit_error', e);
          });
      }

      socket.onAny((event, ...args) => {
        ConduitGrpcSdk.Logger.info(`Socket event: ${event} from socket: ${socket.id}`);
        conduitSocket
          .executeRequest({
            event,
            socketId: socket.id,
            params: args,
            context: socket.data,
          })
          .then(res => this.handleResponse(res, socket, namespace))
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
            socket.emit('conduit_error', e);
          });
      });

      socket.on('disconnect', () => {
        ConduitGrpcSdk.Logger.info(
          `Socket disconnected: ${socket.id} from namespace: ${namespace}`,
        );
        conduitSocket
          .executeRequest({
            event: 'disconnect',
            socketId: socket.id,
            context: socket.data,
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
        ConduitGrpcSdk.Logger.info(
          `Socket ${socket.id} joining rooms: ${push.rooms.join(', ')} in namespace: ${
            push.namespace
          }`,
        );
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
            ConduitGrpcSdk.Logger.info(
              `Socket ${socket.id} leaving room: ${room} in namespace: ${push.namespace}`,
            );
            socket.leave(room);
          }
        }
      }
    } else if (isInstanceOfEventResponse(push)) {
      if (
        (isNil(push.receivers) || push.receivers.length === 0) &&
        push.rooms.length === 0
      ) {
        ConduitGrpcSdk.Logger.info(
          `Emitting event: ${push.event} to all sockets in namespace: ${push.namespace}`,
        );
        this.io.of(push.namespace).emit(push.event, push.data);
      } else {
        if (push.rooms.length !== 0) {
          ConduitGrpcSdk.Logger.info(
            `Emitting event: ${push.event} to rooms: ${push.rooms.join(
              ', ',
            )} in namespace: ${push.namespace}`,
          );
          this.io.of(push.namespace).to(push.rooms).emit(push.event, push.data);
        }
        if (push.receivers.length !== 0) {
          const filteredSockets = await this.findAndFilterSockets(
            push.receivers,
            push.namespace,
          );
          for (const socket of filteredSockets) {
            ConduitGrpcSdk.Logger.info(
              `Emitting event: ${push.event} to socket: ${socket.id} in namespace: ${push.namespace}`,
            );
            socket.emit(push.event, push.data);
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
        ConduitGrpcSdk.Logger.info(
          `Socket ${socket.id} joining rooms: ${res.rooms.join(
            ', ',
          )} in namespace: ${namespace}`,
        );
        socket.join(res.rooms);
      }
    } else if (res.event === 'leave-room') {
      if (res.rooms && res.rooms.length !== 0) {
        for (const room of res.rooms) {
          ConduitGrpcSdk.Logger.info(
            `Socket ${socket.id} leaving room: ${room} in namespace: ${namespace}`,
          );
          socket.leave(room);
        }
      }
    } else if (isInstanceOfEventResponse(res)) {
      if (
        (!res.receivers || res.receivers.length === 0) &&
        (!res.rooms || res.rooms.length === 0)
      ) {
        ConduitGrpcSdk.Logger.info(
          `Emitting event: ${res.event} to all sockets in namespace: ${namespace}`,
        );
        socket.emit(res.event, JSON.parse(res.data));
      } else {
        if (res.rooms && res.rooms.length !== 0) {
          ConduitGrpcSdk.Logger.info(
            `Emitting event: ${res.event} to rooms: ${res.rooms.join(
              ', ',
            )} in namespace: ${namespace}`,
          );
          this.io.of(namespace).to(res.rooms).emit(res.event, JSON.parse(res.data));
        }
        if (res.receivers && res.receivers.length !== 0) {
          const filteredSockets = await this.findAndFilterSockets(
            res.receivers,
            namespace,
          );
          for (const socket of filteredSockets) {
            ConduitGrpcSdk.Logger.info(
              `Emitting event: ${res.event} to socket: ${socket.id} in namespace: ${namespace}`,
            );
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
    const sockets = await this.io.of(namespace).fetchSockets();
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
    this.redisClient.quit();
  }
}
