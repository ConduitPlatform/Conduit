import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Channel, Client, createChannel, createClientFactory } from 'nice-grpc';
import { getModuleNameInterceptor } from './utils';
import { HealthCheckResponse, HealthDefinition } from '../protoUtils/grpc_health_check';
import { EventEmitter } from 'events';
import { EmailDefinition } from '../protoUtils/email';
import { RouterDefinition } from '../protoUtils/router';
import { DatabaseProviderDefinition } from '../protoUtils/database';
import { StorageDefinition } from '../protoUtils/storage';
import { PushNotificationsDefinition } from '../protoUtils/push-notifications';
import { AuthenticationDefinition } from '../protoUtils/authentication';
import { AuthorizationDefinition } from '../protoUtils/authorization';
import { SmsDefinition } from '../protoUtils/sms';
import { ChatDefinition } from '../protoUtils/chat';
import { FormsDefinition } from '../protoUtils/forms';

export default class MockModule<T extends CompatServiceDefinition> {
  private _client: Client<T>;
  private _healthClient?: Client<typeof HealthDefinition>;
  protected channel?: Channel;
  protected readonly healthCheckEmitter = new EventEmitter();
  active: boolean = false;
  private readonly moduleServiceDefinitions: any = {
    router: RouterDefinition,
    database: DatabaseProviderDefinition,
    storage: StorageDefinition,
    email: EmailDefinition,
    pushNotifications: PushNotificationsDefinition,
    authentication: AuthenticationDefinition,
    authorization: AuthorizationDefinition,
    sms: SmsDefinition,
    chat: ChatDefinition,
    forms: FormsDefinition,
  };

  constructor(
    private readonly moduleName: string,
    private readonly serverAddress: string,
    private readonly serviceDefinition: T,
  ) {}

  getModuleClient(moduleName: string, serviceDefinition?: T) {
    const definition: T = serviceDefinition || this.moduleServiceDefinitions[moduleName];
    this.channel = createChannel(this.serverAddress, undefined, {
      'grpc.max _receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    const clientFactory = createClientFactory().use(
      getModuleNameInterceptor(this.moduleName),
    );
    this._client = clientFactory.create(definition, this.channel);
    this._healthClient = clientFactory.create(HealthDefinition, this.channel);
    this.active = true;
    return this._client;
  }

  disconnect() {
    if (!this.channel) return;
    this.channel.close();
    this.channel = undefined;
    this.active = false;
  }

  get healthClient(): Client<typeof HealthDefinition> | undefined {
    return this._healthClient;
  }

  get healthCheckWatcher() {
    return this.healthCheckEmitter;
  }

  check(service: string = '') {
    return this.healthClient!.check({ service }).then((res: HealthCheckResponse) => {
      return res.status;
    });
  }

  async watch(service: string = '') {
    const self = this;
    const serviceName = this.serviceDefinition?.name;
    this.healthCheckEmitter.setMaxListeners(150);
    try {
      const call = this.healthClient!.watch({ service });
      for await (const data of call) {
        self.healthCheckEmitter.emit(`grpc-health-change:${serviceName}`, data.status);
      }
    } catch (error) {
      // uncomment for debug when needed
      // currently is misleading if left on
      // ConduitGrpcSdk.Logger.warn('Connection to gRPC server closed');
    }
  }
}
