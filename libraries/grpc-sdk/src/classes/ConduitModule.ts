import { getModuleNameInterceptor, getGrpcSignedTokenInterceptor } from '../interceptors';
import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Channel, Client, createChannel, createClientFactory } from 'nice-grpc';
import { HealthDefinition, HealthCheckResponse } from '../protoUtils/grpc_health_check';
import { EventEmitter } from 'events';

export class ConduitModule<T extends CompatServiceDefinition> {
  active: boolean = false;
  private _client?: Client<T>;
  private _healthClient?: Client<typeof HealthDefinition>;
  protected channel?: Channel;
  protected protoPath?: string;
  protected type?: T;
  protected readonly _clientName: string;
  protected readonly _serviceUrl: string;
  protected readonly healthCheckEmitter = new EventEmitter();
  protected readonly _grpcToken?: string;

  constructor(
    clientName: string,
    serviceName: string,
    serviceUrl: string,
    grpcToken?: string,
  ) {
    this._clientName = clientName;
    this._serviceUrl = serviceUrl;
    this._grpcToken = grpcToken;
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
    const clientFactory = createClientFactory().use(
      this._grpcToken
        ? getGrpcSignedTokenInterceptor(this._grpcToken)
        : getModuleNameInterceptor(this._clientName),
    );
    this._client = clientFactory.create(this.type!, this.channel);
    this._healthClient = clientFactory.create(HealthDefinition, this.channel);
    this.active = true;
  }

  get client(): Client<T> | undefined {
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
    return this.healthClient!.check({ service }).then((res: HealthCheckResponse) => {
      return res.status;
    });
  }

  async watch(service: string = '') {
    const self = this;
    const serviceName = this.type?.name;
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
