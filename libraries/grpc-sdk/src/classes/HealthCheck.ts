import { getModuleNameInterceptor, getGrpcSignedTokenInterceptor } from '../interceptors';
import { createChannel, createClientFactory } from 'nice-grpc';
import { HealthDefinition, HealthCheckResponse } from '../protoUtils/grpc_health_check';

export async function checkModuleHealth(
  clientName: string,
  serviceUrl: string,
  service: string = '',
  grpcToken?: string,
) {
  let channel = createChannel(serviceUrl, undefined, {
    'grpc.max_receive_message_length': 1024 * 1024 * 100,
    'grpc.max_send_message_length': 1024 * 1024 * 100,
  });
  const clientFactory = createClientFactory().use(
    grpcToken
      ? getGrpcSignedTokenInterceptor(grpcToken)
      : getModuleNameInterceptor(clientName),
  );
  let _healthClient = clientFactory.create(HealthDefinition, channel);
  let error;
  let status = await _healthClient
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
