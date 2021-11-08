import ConduitGrpcSdk, {
  GrpcServer,
} from '..';

export abstract class ConduitServiceModule {
  constructor(protected readonly grpcSdk: ConduitGrpcSdk) {}

  protected _port!: string;
  protected grpcServer!: GrpcServer;

  get port(): string {
    return this._port;
  }

  abstract initialize(): void;
  abstract activate(): void;
}
