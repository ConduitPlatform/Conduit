import { ConduitModule } from '../../classes/index.js';
import { ChatDefinition, Room, SendMessageRequest } from '../../protoUtils/chat.js';

export type SendMessageInput = Omit<SendMessageRequest, 'files'> & {
  files?: SendMessageRequest['files'];
};

export class Chat extends ConduitModule<typeof ChatDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'chat', url, grpcToken);
    this.initializeClient(ChatDefinition);
  }

  sendMessage(messageData: SendMessageInput): Promise<any> {
    return this.client!.sendMessage(SendMessageRequest.fromPartial(messageData));
  }

  createRoom(name: string, participants: string[]): Promise<Room> {
    return this.client!.createRoom({ name, participants });
  }

  deleteRoom(id: string): Promise<Room> {
    return this.client!.deleteRoom({ _id: id });
  }
}
