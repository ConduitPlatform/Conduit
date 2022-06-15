import { ConduitCommons, IConduitCore } from '@conduitplatform/commons';
import { HttpServer } from './routes';
import { GrpcServer } from './GrpcServer';
import { isNil } from 'lodash';

export class Core extends IConduitCore {
  private static _instance: Core;
  private readonly _httpServer: HttpServer;
  private readonly _grpcServer: GrpcServer;

  get httpServer() {
    return this._httpServer;
  }
  get grpcServer() {
    return this._grpcServer;
  }
  get initialized() {
    return this._grpcServer.initialized;
  }

  private constructor(grpcPort: number) {
    super(ConduitCommons.getInstance('core'));
    this.commons.registerCore(this);
    this._grpcServer = new GrpcServer(this.commons, grpcPort);
    this._httpServer = new HttpServer(this.commons);
  }

  static getInstance(grpcPort?: number): Core {
    if (!Core._instance) {
      if (isNil(grpcPort)) {
        throw new Error('Cannot initialize Core without grpcPort');
      }
      Core._instance = new Core(grpcPort);
    }
    return Core._instance;
  }
}
