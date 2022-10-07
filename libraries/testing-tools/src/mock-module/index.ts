import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Client, createChannel, createClientFactory } from 'nice-grpc';
import { getModuleNameInterceptor } from './utils';

export default class MockModule<T extends CompatServiceDefinition> {
  _client: Client<T>;

  constructor(
    private readonly moduleName: string,
    private readonly serverAddress: string,
    serviceDefinition: T,
  ) {
    const channel = createChannel(this.serverAddress, undefined, {
      'grpc.max _receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    const clientFactory = createClientFactory().use(getModuleNameInterceptor(moduleName));
    this._client = clientFactory.create(serviceDefinition, channel);
  }

  //todo health checks

  connect() {}

  disconnect() {}

  register() {}

  configure() {}

  getConfig() {}

  get client() {
    return this._client;
  }
}
