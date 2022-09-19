import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Client, createChannel, createClientFactory } from 'nice-grpc';
import { getModuleNameInterceptor } from '@conduitplatform/grpc-sdk/dist/interceptors';

export class TestUtils<T extends CompatServiceDefinition> {
  protected _client: Client<T>;
  constructor() {}

  createClient(serviceDefinition: T) {
    const channel = createChannel('0.0.0.0:55152', undefined, {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    const clientFactory = createClientFactory().use(getModuleNameInterceptor('test'));
    return clientFactory.create(serviceDefinition, channel);
  }

  get client() {
    return this._client;
  }
}
