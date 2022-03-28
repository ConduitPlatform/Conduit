import { ConduitModule } from '../../classes/ConduitModule';
import {
  ChatClient,
  GetRoomResponse,
  SendMessageRequest,
  SetConfigResponse,
} from '../../protoUtils/chat';
import { ServiceError } from '@grpc/grpc-js';

export class Chat extends ConduitModule<ChatClient> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
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

  sendMessage(messageData: SendMessageRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client?.sendMessage(messageData, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve('Ok');
        }
      });
    });
  }

  createRoom(name: string, participants: string[]): Promise<GetRoomResponse> {
    return new Promise((resolve, reject) => {
      this.client?.createRoom({ name, participants }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  deleteRoom(id: string): Promise<GetRoomResponse> {
    return new Promise((resolve, reject) => {
      this.client?.deleteRoom({ id }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }
}
