import { Application } from 'express';
import { createServer, Server as httpServer } from 'http';
import { Server as IOServer, ServerOptions, Socket } from 'socket.io';


export class SocketController {
  private readonly httpServer: httpServer;
  private io: IOServer;
  private readonly options: Partial<ServerOptions>;

  constructor(private readonly app: Application) {
    this.httpServer = createServer(app);
    this.options = {};
    this.io = new IOServer(this.httpServer, this.options);
    this.httpServer.listen(process.env.SOCKET_PORT || 3001);

    this.io.on('connect', (socket: Socket) => {
      console.log(`connect ${socket.id}`);

      socket.on("ping", (cb) => {
        console.log("ping");
        cb();
      });

      socket.on("disconnect", () => {
        console.log(`disconnect ${socket.id}`);
      });
    })
  }
}
