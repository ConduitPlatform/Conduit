import { getModuleNameInterceptor } from '../interceptors';
import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Channel, Client, createChannel, createClientFactory } from 'nice-grpc';

export class ConduitModule<T extends CompatServiceDefinition> {
  active: boolean = false;
  protected client?: Client<T>;
  protected channel?: Channel;
  protected protoPath?: string;
  protected readonly _name: string;
  protected readonly _url: string;

  // private readonly _interceptors: any[];

  constructor(name: string, url: string) {
    this._name = name;
    this._url = url;
    // this._interceptors = [
    //   getModuleNameInterceptor(this._name),
    // ];
  }

  initializeClient(type: T): Client<T> {
    if (this.client) return this.client;
    this.channel = createChannel(this._url, undefined, {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    this.client = createClientFactory()
      .use(getModuleNameInterceptor(this._name))
      .create(
        type,
        this.channel,
      );
    this.active = true;
    return this.client;
  }

  closeConnection() {
    if (!this.channel) return;
    this.channel.close();
    this.client = undefined;
    this.channel = undefined;
    this.active = false;
  }
}
