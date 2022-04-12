import { ConduitCommons } from '@conduitplatform/commons';
import { HttpServer} from './HttpServer';
import { GrpcServer } from './GrpcServer';
import { isNil } from 'lodash';

export class Core {
  private static _instance: Core;
  private readonly commons: ConduitCommons;
  private readonly _httpServer: HttpServer;
  private readonly _grpcServer: GrpcServer;

  get httpServer() { return this._httpServer; }
  get grpcServer() { return this._grpcServer; }
  get initialized() { return this._httpServer.initialized && this._grpcServer.initialized; }

  private constructor(httpPort: number | string, grpcPort: number) {
    this.commons = ConduitCommons.getInstance('core');
    this._grpcServer = new GrpcServer(this.commons, grpcPort);
    this._httpServer = new HttpServer(httpPort, this.commons);
  }

  static getInstance(httpPort?: number | string, grpcPort?: number): Core {
    if (!Core._instance) {
      if (isNil(httpPort) || isNil(grpcPort)) {
        throw new Error('Cannot initialize Core without httpPort and grpcPort');
      }
      Core._instance = new Core(httpPort, grpcPort);
    }
    return Core._instance;
  }
}
