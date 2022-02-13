import { ConduitModule } from '../../classes/ConduitModule';
import { ChatDefinition, GetRoomResponse, SendMessageRequest, SetConfigResponse } from '../../protoUtils/chat';

export class Chat extends ConduitModule<typeof ChatDefinition> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(ChatDefinition);
  }

  setConfig(newConfig: any): Promise<SetConfigResponse> {
    return this.client!.setConfig({ newConfig: JSON.stringify(newConfig) });
  }

  sendMessage(messageData: SendMessageRequest): Promise<any> {
    return this.client!.sendMessage(messageData);
  }

  createRoom(name: string, participants: string[]): Promise<GetRoomResponse> {
    return this.client!.createRoom({ name, participants });
  }

  deleteRoom(id: string): Promise<GetRoomResponse> {
    return this.client!.deleteRoom({ id });
  }
}
