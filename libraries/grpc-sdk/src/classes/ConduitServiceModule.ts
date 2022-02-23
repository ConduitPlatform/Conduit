import ConduitGrpcSdk, {
  GrpcServer,
} from '..';

export abstract class ConduitServiceModule {
  constructor() {}

  protected _port!: string;
  protected grpcServer!: GrpcServer;
  private _grpcSdk: ConduitGrpcSdk | undefined;

  public set grpcSdk(grpcSdk: ConduitGrpcSdk) {
    if (this._grpcSdk) throw new Error('grpcSdk already defined');
    this._grpcSdk = grpcSdk;
  }

  public get grpcSdk(): ConduitGrpcSdk {
    if (!this._grpcSdk) throw new Error('grpcSdk not defined yet');
    return this._grpcSdk;
  }

  get port(): string {
    return this._port;
  }
}
