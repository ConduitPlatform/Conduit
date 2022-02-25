import { getModuleNameInterceptor } from '../interceptors';
import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { Channel, Client, createChannel, createClientFactory } from 'nice-grpc';

export class ConduitModule<T extends CompatServiceDefinition> {
  active: boolean = false;
  private _client?: Client<T>;
  protected channel?: Channel;
  protected protoPath?: string;
  protected type?: T;
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
    if (this._client) return this._client;
    this.type = type;
    this.openConnection();
    return this._client!;
  }

  openConnection() {
    this.channel = createChannel(this._url, undefined, {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    this._client = createClientFactory()
      .use(getModuleNameInterceptor(this._name))
      .create(
        this.type!,
        this.channel,
      );
    this.active = true;
  }

  get client(): Client<T> | undefined{
    return this._client;
  }

  closeConnection() {
    if (!this.channel) return;
    this.channel.close();
    this.channel = undefined;
    this.active = false;
  }
}
