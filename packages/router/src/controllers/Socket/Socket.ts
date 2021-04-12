import { Application } from 'express';
import { createServer, Server as httpServer } from 'http';
import { Server as IOServer, ServerOptions, Socket } from 'socket.io';
import { createAdapter } from 'socket.io-redis';
import { RedisClient } from 'redis';
import {
  ConduitSocket,
  EventResponse, isInstanceOfEventResponse,
  JoinRoomResponse,
} from '@quintessential-sft/conduit-sdk';
import { isNil, isArray } from 'lodash';


export class SocketController {
  private readonly httpServer: httpServer;
  private io: IOServer;
  private readonly options: Partial<ServerOptions>;
  private _registeredNamespaces: Map<string, ConduitSocket>;
  private pubClient: RedisClient;
  private subClient: RedisClient;

  constructor(private readonly app: Application) {
    if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
      console.error('Redis IP not defined');
      process.exit(-1);
    }

    this.httpServer = createServer(app);
    this.options = {};
    this.io = new IOServer(this.httpServer, this.options);
    this.pubClient = new RedisClient({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) });
    this.subClient = this.pubClient.duplicate();
    this.io.adapter(createAdapter({ pubClient: this.pubClient, subClient: this.subClient }));
    this.httpServer.listen(process.env.SOCKET_PORT || 3001);
    this._registeredNamespaces = new Map();
  }

  registerConduitSocket(conduitSocket: ConduitSocket) {
    const namespace = conduitSocket.input.path;
    if (this._registeredNamespaces.has(namespace)) {
      return;
    }

    this._registeredNamespaces.set(namespace, conduitSocket);
    this.io.of(namespace).on('connect', socket => {
      conduitSocket.executeRequest({
        event: 'connect',
        socketId: socket.id
      })
      .then((res) => {
        this.handleResponse(res, socket);
      })
      .catch(() => {});

      socket.onAny((event, ...args) => {
        conduitSocket.executeRequest({
          event,
          socketId: socket.id,
          params: args
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
      socket.join(res.rooms);
    }
  }
}
