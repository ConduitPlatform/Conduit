import ConduitGrpcSdk, {
  HealthCheckStatus,
  GrpcServer as ConduitGrpcServer,
  GrpcRequest,
  GrpcCallback,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import { ServerWritableStream } from '@grpc/grpc-js';
import { isNaN } from 'lodash';

function getGrpcPort() {
  const value = process.env['SERVICE_PORT'] ?? '55152';
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 0) {
    throw new Error(`Invalid gRPC port value: ${port}`);
  }
  return port;
}

function boot() {
  let server = new ConduitGrpcServer(getGrpcPort().toString());
  server
    .createNewServer()
    .then(port => {
      const _url = '0.0.0.0:' + port.toString();
      server.start();
      console.log('gRPC server listening on:', _url);
    })
    .then(() => {
      return addHealthService(server);
    })
    .then()
    .catch(err => {
      console.error(err);
      process.exit(-1);
    });
}

function addHealthService(server: ConduitGrpcServer) {
  return server.addService(
    path.resolve(__dirname, './grpc_health_check.proto'),
    'grpc.health.v1.Health',
    {
      Check: healthCheck,
      Watch: healthWatch,
    },
  );
}

function healthCheck(
  call: GrpcRequest<{ service: string }>,
  callback: GrpcCallback<{ status: HealthCheckStatus }>,
) {
  callback(null, { status: this.getServiceHealthState(call.request.service) });
}

function healthWatch(
  call: ServerWritableStream<{ service: string }, { status: HealthCheckStatus }>,
) {
  const healthState = this.getServiceHealthState(call.request.service);
  if (healthState === HealthCheckStatus.SERVICE_UNKNOWN) {
    call.write({ status: HealthCheckStatus.SERVICE_UNKNOWN });
  } else {
    this.events.on('grpc-health-change:Core', (status: HealthCheckStatus) => {
      call.write({ status });
    });
  }
}
