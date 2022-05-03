import { ConduitCommons, IConduitCore } from '@conduitplatform/commons';
import { HttpServer} from './HttpServer';
import { GrpcServer } from './GrpcServer';
import { isNil } from 'lodash';

export class Core extends IConduitCore {
  private static _instance: Core;
  private readonly _httpServer: HttpServer;
  private readonly _grpcServer: GrpcServer;

  get httpServer() { return this._httpServer; }
  get grpcServer() { return this._grpcServer; }
  get initialized() { return this._httpServer.initialized && this._grpcServer.initialized; }

  private constructor(httpPort: number | string, grpcPort: number) {
    super(ConduitCommons.getInstance('core'));
    this.commons.registerCore(this);
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
