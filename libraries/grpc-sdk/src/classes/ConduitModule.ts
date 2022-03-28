import { ChannelCredentials, ChannelOptions, Client, credentials } from '@grpc/grpc-js';
import { getModuleNameInterceptor } from '../interceptors';

export class ConduitModule<T extends Client> {
  // protected descriptorObj?: string;
  active: boolean = false;
  constructorObj?: {
    new (
      address: string,
      credentials: ChannelCredentials,
      options?: Partial<ChannelOptions>
    ): T;
  };
  protected client?: T;
  protected protoPath?: string;
  protected readonly _url: string;
  protected readonly _name: string;
  private readonly _interceptors: any[];

  constructor(name: string, url: string) {
    this._name = name;
    this._url = url;
    this._interceptors = [getModuleNameInterceptor(this._name)];
  }

  initializeClient(constObj?: {
    new (
      address: string,
      credentials: ChannelCredentials,
      options?: Partial<ChannelOptions>
    ): T;
  }) {
    if (this.client) return;
    if (!this.constructorObj && constObj) {
      this.constructorObj = constObj;
    } else if (!this.constructorObj && !constObj) {
      throw new Error('Client cannot be initialized, both constructor objects are null!');
    }
    this.client = new this.constructorObj!(
      this._url,
      credentials.createInsecure(),
      {
        'grpc.max_receive_message_length': 1024 * 1024 * 100,
        'grpc.max_send_message_length': 1024 * 1024 * 100,
        interceptors: this._interceptors,
      }
    );
    this.active = true;
  }

  closeConnection() {
    if (!this.client) return;
    this.client?.close();
    this.client = undefined;
    this.active = false;
  }
}
