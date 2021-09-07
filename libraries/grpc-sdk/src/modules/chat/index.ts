import { ConduitModule } from '../../classes/ConduitModule';
import { ChatClient, SetConfigResponse } from '../../protoUtils/chat';
import { ServiceError } from '@grpc/grpc-js';

export class Chat extends ConduitModule<ChatClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(ChatClient);
  }

  setConfig(newConfig: any): Promise<SetConfigResponse> {
    return new Promise((resolve, reject) => {
      this.client?.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: ServiceError | null, res) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      );
    });
  }
}
