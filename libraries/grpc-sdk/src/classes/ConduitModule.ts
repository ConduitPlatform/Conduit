import { ChannelCredentials, ChannelOptions, Client, credentials } from '@grpc/grpc-js';

export class ConduitModule<T extends Client> {
  protected client?: T;
  protected readonly _url: string;
  protected protoPath?: string;
  // protected descriptorObj?: string;
  active: boolean = false;

  constructor(url: string) {
    this._url = url;
  }

  initializeClient(constObj: {
    new (
      address: string,
      credentials: ChannelCredentials,
      options?: Partial<ChannelOptions>
    ): T;
  }) {
    if (this.client) return;
    this.client = new constObj(this._url, credentials.createInsecure(), {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    // this.client = createGrpcClient(this._url, this.protoPath!, this.descriptorObj!);
    this.active = true;
  }

  closeConnection() {
    this.client?.close();
    this.client = undefined;
    this.active = false;
  }
}
