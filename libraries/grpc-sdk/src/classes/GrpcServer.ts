import { addServiceToServer, createServer } from '../helpers';
import { Server } from '@grpc/grpc-js';

export class GrpcServer {
  private grpcServer?: Server;
  private started: boolean = false;
  private startedOnce: boolean = false;
  private _serviceNames: string[] = [];
  private scheduledRestart: any;
  private _services: {
    protoFilePath: string;
    protoDescription: string;
    functions: { [name: string]: Function };
  }[] = [];

  constructor(originalUrl?: string) {
    this._url = originalUrl || '0.0.0.0:5000';
  }

  private _url: string;

  get url(): string {
    return this._url;
  }

  async createNewServer(): Promise<number> {
    let serverResult = await createServer(this._url);
    this.grpcServer = serverResult.server;
    this._url = this._url.split(':')[0] + ':' + serverResult.port.toString();
    return serverResult.port;
  }

  async addService(
    protoFilePath: string,
    protoDescription: string,
    functions: { [name: string]: Function }
  ): Promise<GrpcServer> {
    if (this._serviceNames.indexOf(protoDescription) !== -1) {
      console.log('Service already exists, performing replace');
      this._services[this._serviceNames.indexOf(protoDescription)] = {
        protoFilePath,
        protoDescription,
        functions,
      };
      this.scheduleRefresh();
      return this;
    } else {
      this._services.push({ protoFilePath, protoDescription, functions });
      this._serviceNames.push(protoDescription);
      if (this.started) {
        console.log('Server already started, scheduling refresh..');
        this.scheduleRefresh();
        return this;
      } else {
        if (!this.grpcServer) {
          await this.wait(1000);
        }
        addServiceToServer(this.grpcServer!, protoFilePath, protoDescription, functions);
        return this;
      }
    }
  }

  async wait(time: number) {
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, time);
    });
  }

  async refresh(): Promise<void> {
    if (this.started) {
      this.started = false;
      //gracefully shutdown so that there are no service disruption
      await new Promise((resolve) => this.grpcServer!.tryShutdown(() => resolve()));
    }
    await this.createNewServer();
    this._services.forEach((service) => {
      addServiceToServer(
        this.grpcServer!,
        service.protoFilePath,
        service.protoDescription,
        service.functions
      );
    });
    if (!this.started && this.startedOnce) {
      this.grpcServer!.start();
      this.started = true;
    }
  }

  scheduleRefresh() {
    if (this.scheduledRestart) {
      clearTimeout(this.scheduledRestart);
    }
    const self = this;
    this.scheduledRestart = setTimeout(async () => {
      console.log('Begin refresh');
      await self.refresh();
      console.log('Refresh complete');
    }, 2000);
  }

  start(): void {
    if (this.started) {
      console.error('Grpc server is already running!');
      return;
    } else if (!this.started && this.startedOnce) {
      console.error('Grpc server is down for refresh!');
    }
    this.started = true;
    this.startedOnce = true;
    this.grpcServer?.start();
  }
}
