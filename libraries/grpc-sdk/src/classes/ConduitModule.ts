import { getModuleNameInterceptor } from '../interceptors';
import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Channel, Client, createChannel, createClientFactory } from 'nice-grpc';
import { HealthDefinition, HealthCheckResponse } from '../protoUtils/grpc_health_check';
import { EventEmitter } from 'events';

export class ConduitModule<T extends CompatServiceDefinition> {
  active: boolean = false;
  private _client?: Client<T>;
  private _healthClient?: Client<typeof HealthDefinition>
  protected channel?: Channel;
  protected protoPath?: string;
  protected type?: T;
  protected readonly _clientName: string;
  protected readonly _serviceName: string;
  protected readonly _serviceUrl: string;
  protected readonly healthCheckEmitter = new EventEmitter();

  constructor(clientName: string, serviceName: string, serviceUrl: string) {
    this._clientName = clientName;
    this._serviceName = serviceName;
    this._serviceUrl = serviceUrl;
  }

  initializeClient(type: T): Client<T> {
    if (this._client) return this._client;
    this.type = type;
    this.openConnection();
    return this._client!;
  }

  openConnection() {
    this.channel = createChannel(this._serviceUrl, undefined, {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    this._client = createClientFactory()
      .use(getModuleNameInterceptor(this._clientName))
      .create(
        this.type!,
        this.channel,
      );
    this._healthClient = createClientFactory()
      .use(getModuleNameInterceptor(this._clientName))
      .create(
        HealthDefinition,
        this.channel,
      );
    this.active = true;
  }

  get client(): Client<T> | undefined{
    return this._client;
  }

  get healthClient(): Client<typeof HealthDefinition> | undefined {
    return this._healthClient;
  }

  get healthCheckWatcher() {
    return this.healthCheckEmitter;
  }

  closeConnection() {
    if (!this.channel) return;
    this.channel.close();
    this.channel = undefined;
    this.active = false;
  }

  check(service: string = '') {
    return this.healthClient!.check({ service })
      .then((res: HealthCheckResponse) => {
        return res.status;
      });
  }

  async watch(service: string = '') {
    const self = this;
    this.healthCheckEmitter.setMaxListeners(150);
    try {
      const call = this.healthClient!.watch({ service });
      for await (const data of call) {
        self.healthCheckEmitter.emit(`grpc-health-change:${this._serviceName}`, data.status);
      }
    } catch (error) {
      console.error('Connection to gRPC server closed');
    }
  }
}
