import {
  getGrpcSignedTokenInterceptor,
  getModuleNameInterceptor,
} from '../interceptors/index.js';
import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Channel, Client, createChannel, createClientFactory } from 'nice-grpc';
import { retryMiddleware } from 'nice-grpc-client-middleware-retry';
import {
  ConduitModuleDefinition,
  HealthCheckResponse,
  HealthDefinition,
} from '../protoUtils/index.js';
import { EventEmitter } from 'events';
import ConduitGrpcSdk from '../index.js';

export class ConduitModule<T extends CompatServiceDefinition> {
  protected channel?: Channel;
  protected protoPath?: string;
  protected type?: T;
  protected readonly healthCheckEmitter = new EventEmitter();

  constructor(
    readonly _clientName: string,
    private readonly _serviceName: string,
    private readonly _serviceUrl: string,
    private readonly _grpcToken?: string,
  ) {}

  private _client?: Client<T>;

  get client(): Client<T> | undefined {
    return this._client;
  }

  private _healthClient?: Client<typeof HealthDefinition>;

  get healthClient(): Client<typeof HealthDefinition> | undefined {
    return this._healthClient;
  }

  private _moduleClient?: Client<typeof ConduitModuleDefinition>;

  get moduleClient(): Client<typeof ConduitModuleDefinition> | undefined {
    return this._moduleClient;
  }

  get active(): boolean {
    if (!this.channel) {
      return false;
    }
    const connectivityState = this.channel.getConnectivityState(true);
    return connectivityState === 2 || connectivityState === 1 || connectivityState === 0;
  }

  get healthCheckWatcher() {
    return this.healthCheckEmitter;
  }

  initializeClient(type: T): Client<T> {
    if (this._client) return this._client;
    this.type = type;
    this.openConnection();
    return this._client!;
  }

  openConnection() {
    if (this.channel) {
      // used to make sure a connection attempt is made
      this.channel.getConnectivityState(true);
      return;
    }
    // ConduitGrpcSdk.Logger.log(`Opening connection for ${this._serviceName}`);
    this.channel = createChannel(this._serviceUrl, undefined, {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    let clientFactory = createClientFactory()
      .use(
        this._grpcToken
          ? getGrpcSignedTokenInterceptor(this._grpcToken)
          : getModuleNameInterceptor(this._clientName),
      )
      .use(retryMiddleware);
    for (const interceptor of ConduitGrpcSdk.interceptors) {
      clientFactory = clientFactory.use(interceptor);
    }
    this._client = clientFactory.create(this.type!, this.channel, {
      '*': {
        // https://grpc.github.io/grpc/core/md_doc_statuscodes.html
        retryableStatuses: [1, 10, 14], // handle: cancelled, aborted, unavailable
        retryBaseDelayMs: 250,
        retryMaxAttempts: 5,
        retry: true,
      },
    });
    this._healthClient = clientFactory.create(HealthDefinition, this.channel);
    this._moduleClient = clientFactory.create(ConduitModuleDefinition, this.channel);
    const monitorChannel = () => {
      if (!this.channel) return;
      try {
        const state = this.channel!.getConnectivityState(true);
        this.channel!.watchConnectivityState(state, Infinity, monitorChannel);
      } catch (e) {}
    };
    monitorChannel();
  }

  closeConnection() {
    if (!this.channel) return;
    // ConduitGrpcSdk.Logger.warn(`Closing connection for ${this._serviceName}`);
    this.channel.close();
    this.channel = undefined;
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
