import { ConduitModule } from '../../classes/ConduitModule';
import { ChatDefinition, Room, SendMessageRequest } from '../../protoUtils/chat';

export class Chat extends ConduitModule<typeof ChatDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'chat', url, grpcToken);
    this.initializeClient(ChatDefinition);
  }

  sendMessage(messageData: SendMessageRequest): Promise<any> {
    return this.serviceClient!.sendMessage(messageData);
  }

  createRoom(name: string, participants: string[]): Promise<Room> {
    return this.serviceClient!.createRoom({ name, participants });
  }

  deleteRoom(id: string): Promise<Room> {
    return this.serviceClient!.deleteRoom({ id });
  }
}
