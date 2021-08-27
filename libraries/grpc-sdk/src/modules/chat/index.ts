import { ConduitModule } from '../../classes/ConduitModule';
import { ChatClient } from '../../protoUtils/chat';

export class Chat extends ConduitModule<ChatClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(ChatClient);
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client?.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: any, res: any) => {
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
