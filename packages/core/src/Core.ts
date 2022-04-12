import { ConduitCommons } from '@conduitplatform/commons';
import { HttpServer} from './HttpServer';
import { GrpcServer } from './GrpcServer';

export class Core {
  private static instance: Core;
  private conduitSdk: ConduitCommons;
  private _httpServer: HttpServer;
  private _grpcServer: GrpcServer;

  get httpServer() { return this._httpServer; }
  get grpcServer() { return this._grpcServer; }
  get initialized() { return this._httpServer.initialized && this._grpcServer.initialized; }

  private constructor() {}

  initialize(httpPort: number | string, grpcPort: number) {
    this.conduitSdk = ConduitCommons.getInstance('core');
    this._grpcServer = new GrpcServer(this.conduitSdk, grpcPort);
    this._httpServer = new HttpServer(httpPort, this.conduitSdk);
  }

  static getInstance(): Core {
    if (!Core.instance) {
      Core.instance = new Core();
    }
    return Core.instance;
  }
}
