import ConduitGrpcSdk, {
  GrpcServer,
  HealthCheckStatus,
} from '..';
import path from 'path';

export abstract class ConduitServiceModule {
  protected constructor() {}

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

  protected async addHealthCheckService() {
    await this.grpcServer.addService(
      path.resolve(__dirname, '../../src/grpc_health_check.proto'),
      'grpc.health.v1.Health',
      {
        Check: this.healthCheck.bind(this),
        Watch: this.healthWatch.bind(this),
      }
    );
  }

  healthCheck(call: any, callback: any) {
    // Override this in modules implementing the gRPC health checking protocol
    callback(null, { status: HealthCheckStatus.SERVING });
  }

  healthWatch(call: any) {
    // Override this in modules implementing the gRPC health checking protocol
    call.write({status: HealthCheckStatus.SERVING});
  }
}
