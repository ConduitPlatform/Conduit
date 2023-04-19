import { addServiceToServer, createServer, wrapGrpcFunctions } from '../helpers';
import { Server } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import ConduitGrpcSdk, { GrpcRequest, GrpcCallback } from '@conduitplatform/grpc-sdk';

export class GrpcServer {
  private grpcServer?: Server;
  private started: boolean = false;
  private startedOnce: boolean = false;
  private _serviceNames: string[] = [];
  private scheduledRestart: any;
  private _postponeRequests = 0;
  private _useForce?: boolean;
  private _services: {
    protoPath: string;
    protoDescription: string;
    functions: {
      [name: string]: (call: GrpcRequest<any>, callback: GrpcCallback<any>) => void;
    };
  }[] = [];

  constructor(port?: string) {
    this._url = `0.0.0.0:${port ?? '5000'}`;
  }

  private _url: string;

  get url(): string {
    return this._url;
  }

  async createNewServer(useForce: boolean = false): Promise<number> {
    if (isNil(this._useForce)) {
      this._useForce = useForce;
    }
    const serverResult = await createServer(this._url);
    this.grpcServer = serverResult.server;
    this._url = this._url.split(':')[0] + ':' + serverResult.port.toString();
    return serverResult.port;
  }

  async addService(
    protoPath: string,
    protoDescription: string,
    functions: {
      [name: string]: (call: GrpcRequest<any>, callback: GrpcCallback<any>) => void;
    },
  ): Promise<GrpcServer> {
    functions = wrapGrpcFunctions(functions, this.postponeRestart.bind(this));
    if (this._serviceNames.indexOf(protoDescription) !== -1) {
      ConduitGrpcSdk.Logger.log('Service already exists, performing replace');
      this._services[this._serviceNames.indexOf(protoDescription)] = {
        protoPath,
        protoDescription,
        functions,
      };
      this.scheduleRefresh();
      return this;
    } else {
      this._services.push({ protoPath, protoDescription, functions });
      this._serviceNames.push(protoDescription);
      if (this.started) {
        ConduitGrpcSdk.Logger.log('Server already started, scheduling refresh..');
        this.scheduleRefresh();
        return this;
      } else {
        if (!this.grpcServer) {
          await this.wait(1000);
        }
        addServiceToServer(this.grpcServer!, protoPath, protoDescription, functions);
        return this;
      }
    }
  }

  async wait(time: number) {
    return new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, time);
    });
  }

  async refresh(): Promise<void> {
    if (this.started) {
      this.started = false;
      if (this._useForce) {
        this.grpcServer!.forceShutdown();
      } else {
        //gracefully shutdown so that there are no service disruption
        await new Promise<void>(resolve => this.grpcServer!.tryShutdown(() => resolve()));
      }
    }
    await this.createNewServer();
    this._services.forEach(service => {
      addServiceToServer(
        this.grpcServer!,
        service.protoPath,
        service.protoDescription,
        service.functions,
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
      ConduitGrpcSdk.Logger.log('Begin refresh');
      await self.refresh();
      ConduitGrpcSdk.Logger.log('Refresh complete');
      clearTimeout(self.scheduledRestart);
      self.scheduledRestart = undefined;
      self._postponeRequests = 0;
    }, 2000);
  }

  start(): void {
    if (this.started) {
      ConduitGrpcSdk.Logger.error('gRPC server is already running!');
      return;
    } else if (!this.started && this.startedOnce) {
      ConduitGrpcSdk.Logger.error('gRPC server is down for refresh!');
    }
    this.started = true;
    this.startedOnce = true;
    this.grpcServer?.start();
  }

  private postponeRestart() {
    if (!this.scheduledRestart || this._postponeRequests > 5) return;
    this._postponeRequests++;
    this.scheduleRefresh();
  }
}
