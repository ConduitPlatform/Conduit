import {
  getGrpcSignedTokenInterceptor,
  getModuleNameInterceptor,
} from '../interceptors/index.js';
import { createChannel, createClientFactory } from 'nice-grpc';
import {
  HealthCheckResponse,
  HealthDefinition,
} from '../protoUtils/grpc_health_check.js';
import { ConduitGrpcSdk } from '../index.js';

export async function checkModuleHealth(
  clientName: string,
  serviceUrl: string,
  service: string = '',
  grpcToken?: string,
) {
  const channel = createChannel(serviceUrl, undefined, {
    'grpc.max_receive_message_length': 1024 * 1024 * 100,
    'grpc.max_send_message_length': 1024 * 1024 * 100,
  });
  let clientFactory = createClientFactory().use(
    grpcToken
      ? getGrpcSignedTokenInterceptor(grpcToken)
      : getModuleNameInterceptor(clientName),
  );
  for (const interceptor of ConduitGrpcSdk.interceptors) {
    clientFactory = clientFactory.use(interceptor);
  }
  const _healthClient = clientFactory.create(HealthDefinition, channel);

  let error;
  const status = await _healthClient
    .check({ service })
    .then((res: HealthCheckResponse) => {
      return res.status;
    })
    .catch(err => (error = err));
  channel.close();
  if (!error) {
    return status;
  }
  throw error;
}
