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
  LeaveRoomResponse,
  SocketPush,
} from '../interfaces/index.js';
import ObjectHash from 'object-hash';
import { ConduitError, ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { buildSocketMiddlewareParams } from './buildSocketMiddlewareParams.js';
import { resolveEngineNamespacePath } from './resolveEngineNamespacePath.js';

const EMIT_TIMEOUT_MS = 250;
const SEND_BUFFER_HIGH_WATER_MARK = 512 * 1024;

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
      maxHttpBufferSize: 1e6,
      connectionStateRecovery: {
        // the backup duration of the sessions and the packets
        maxDisconnectionDuration: 2 * 60 * 1000,
        // whether to skip middlewares upon successful recovery
        skipMiddlewares: true,
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

    this.io.engine.use((req: any, res: any, next: any) => {
      req.path = resolveEngineNamespacePath(req);
      let index = 0;
      const run = (err?: Error) => {
        if (err) {
          return next(err);
        }
        const middleware = this.globalMiddlewares[index++];
        if (!middleware) {
          return next();
        }
        middleware(req, res, run);
      };
      run();
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
    this.io.of(namespace).use((socket, next) => {
      const context = buildSocketMiddlewareParams(socket);
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
        ConduitGrpcSdk.Logger.debug(
          `Socket recovered: ${socket.id} to namespace: ${namespace}`,
        );
        const recovered = conduitSocket.executeRecovered({
          event: 'recovered',
          socketId: socket.id,
          context: socket.data,
        });
        if (recovered) {
          recovered
            .then(res => this.handleResponse(res, socket, namespace))
            .catch(e => {
              ConduitGrpcSdk.Logger.error(e);
              socket.emit('conduit_error', e);
            });
        }
      } else {
        ConduitGrpcSdk.Logger.debug(
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
        ConduitGrpcSdk.Logger.debug(`Socket event: ${event} from socket: ${socket.id}`);
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
        ConduitGrpcSdk.Logger.debug(
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

  async handleSocketPush(push: SocketPush): Promise<boolean> {
    const localOnly = push.localOnly === true;
    if (push.event === 'join-room') {
      if (push.rooms.length === 0) return false;
      const filteredSockets = await this.findAndFilterSockets(
        push.receivers,
        push.namespace,
        localOnly,
      );
      for (const socket of filteredSockets) {
        ConduitGrpcSdk.Logger.debug(
          `Socket ${socket.id} joining rooms: ${push.rooms.join(', ')} in namespace: ${
            push.namespace
          }`,
        );
        socket.join(push.rooms);
      }
      return true;
    } else if (push.event === 'leave-room') {
      if (push.rooms && push.rooms.length !== 0) {
        const filteredSockets = await this.socketsForRoomPush(push, localOnly);
        for (const socket of filteredSockets) {
          for (const room of push.rooms) {
            ConduitGrpcSdk.Logger.debug(
              `Socket ${socket.id} leaving room: ${room} in namespace: ${push.namespace}`,
            );
            socket.leave(room);
          }
        }
      }
      return true;
    } else if (isInstanceOfEventResponse(push)) {
      if (
        (isNil(push.receivers) || push.receivers.length === 0) &&
        push.rooms.length === 0
      ) {
        return false;
      }
      if (push.rooms.length !== 0) {
        const emitted = await this.emitEventToRooms(push, localOnly);
        if (!emitted) {
          return false;
        }
      }
      if (push.receivers.length !== 0) {
        const filteredSockets = await this.findAndFilterSockets(
          push.receivers,
          push.namespace,
          localOnly,
        );
        for (const socket of filteredSockets) {
          if (push.boundedEmit && this.isSocketBackpressured(socket)) {
            ConduitGrpcSdk.Metrics?.increment('event_relays_emit_dropped_total');
            socket.disconnect(true);
            continue;
          }
          ConduitGrpcSdk.Logger.debug(
            `Emitting event: ${push.event} to socket: ${socket.id} in namespace: ${push.namespace}`,
          );
          socket.emit(push.event, push.data);
        }
      }
      return true;
    }
    return false;
  }

  async getLocalRoomUserIds(namespace: string, room: string): Promise<string[]> {
    const sockets = await this.io.of(namespace).in(room).local.fetchSockets();
    const userIds = new Set<string>();
    for (const socket of sockets) {
      const userId = socket.data?.user?._id;
      if (typeof userId === 'string' && userId.length > 0) {
        userIds.add(userId);
      }
    }
    return [...userIds];
  }

  async getLocalRoomsWithPrefix(namespace: string, prefix: string): Promise<string[]> {
    const adapter = this.io.of(namespace).adapter as { rooms?: Map<string, unknown> };
    const rooms = adapter.rooms;
    if (!rooms) {
      return [];
    }
    return [...rooms.keys()].filter(room => room.startsWith(prefix));
  }

  private async emitEventToRooms(push: SocketPush, localOnly: boolean): Promise<boolean> {
    const nsp = this.io.of(push.namespace);
    if (push.skipEmptyRooms || push.boundedEmit) {
      let memberCount = 0;
      for (const room of push.rooms) {
        const sockets = localOnly
          ? await nsp.in(room).local.fetchSockets()
          : await nsp.in(room).fetchSockets();
        memberCount += sockets.length;
        if (push.boundedEmit) {
          for (const socket of sockets) {
            if (this.isSocketBackpressured(socket)) {
              ConduitGrpcSdk.Metrics?.increment('event_relays_emit_dropped_total');
              socket.disconnect(true);
            }
          }
        }
      }
      if (memberCount === 0) {
        return false;
      }
    }

    ConduitGrpcSdk.Logger.debug(
      `Emitting event: ${push.event} to rooms: ${push.rooms.join(
        ', ',
      )} in namespace: ${push.namespace}`,
    );
    const target = nsp.to(push.rooms);
    if (localOnly) {
      if (push.boundedEmit) {
        await Promise.race([
          new Promise<void>(resolve => {
            target.local.emit(push.event, push.data, () => resolve());
          }),
          new Promise<void>(resolve => setTimeout(resolve, EMIT_TIMEOUT_MS)),
        ]);
      } else {
        target.local.emit(push.event, push.data);
      }
    } else if (push.boundedEmit) {
      await Promise.race([
        new Promise<void>(resolve => {
          target.emit(push.event, push.data, () => resolve());
        }),
        new Promise<void>(resolve => setTimeout(resolve, EMIT_TIMEOUT_MS)),
      ]);
    } else {
      target.emit(push.event, push.data);
    }
    return true;
  }

  private isSocketBackpressured(socket: RemoteSocket<any, any> | Socket): boolean {
    const conn = (socket as Socket).conn ?? (socket as RemoteSocket<any, any>).conn;
    const transport = conn?.transport as { writableLength?: number } | undefined;
    const buffered =
      typeof transport?.writableLength === 'number' ? transport.writableLength : 0;
    return buffered > SEND_BUFFER_HIGH_WATER_MARK;
  }

  private async socketsForRoomPush(
    push: SocketPush,
    localOnly: boolean,
  ): Promise<RemoteSocket<any, any>[]> {
    if (push.receivers.length > 0) {
      return this.findAndFilterSockets(push.receivers, push.namespace, localOnly);
    }
    const nsp = this.io.of(push.namespace);
    const seen = new Set<string>();
    const sockets: RemoteSocket<any, any>[] = [];
    for (const room of push.rooms) {
      const inRoom = localOnly
        ? await nsp.in(room).local.fetchSockets()
        : await nsp.in(room).fetchSockets();
      for (const socket of inRoom) {
        if (!seen.has(socket.id)) {
          seen.add(socket.id);
          sockets.push(socket);
        }
      }
    }
    return sockets;
  }

  private async handleResponse(
    res: EventResponse | JoinRoomResponse | LeaveRoomResponse,
    socket: Socket,
    namespace: string,
  ) {
    if (res.event === 'join-room') {
      if (res.rooms && res.rooms.length !== 0) {
        ConduitGrpcSdk.Logger.debug(
          `Socket ${socket.id} joining rooms: ${res.rooms.join(
            ', ',
          )} in namespace: ${namespace}`,
        );
        socket.join(res.rooms);
      }
    } else if (res.event === 'leave-room') {
      if (res.rooms && res.rooms.length !== 0) {
        for (const room of res.rooms) {
          ConduitGrpcSdk.Logger.debug(
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
        ConduitGrpcSdk.Logger.debug(
          `Emitting event: ${res.event} to all sockets in namespace: ${namespace}`,
        );
        socket.emit(res.event, JSON.parse(res.data));
      } else {
        if (res.rooms && res.rooms.length !== 0) {
          ConduitGrpcSdk.Logger.debug(
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
            ConduitGrpcSdk.Logger.debug(
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
    localOnly: boolean = false,
  ): Promise<RemoteSocket<any, any>[]> {
    const nsp = this.io.of(namespace);
    const sockets = localOnly ? await nsp.local.fetchSockets() : await nsp.fetchSockets();
    const userIdSet = new Set(userIds);
    return sockets.filter(socket => {
      if (socket.data && socket.data.user) {
        return userIdSet.has(socket.data.user._id);
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
