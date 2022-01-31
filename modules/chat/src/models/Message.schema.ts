import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/conduit-grpc-sdk';
import { ChatRoom } from './ChatRoom.schema'
import { User } from './User.model';

const schema = {
  _id: TYPE.ObjectId,
  message: TYPE.String,
  senderUser: {
    type: TYPE.Relation,
    model: 'User'
  },
  room: {
    type: TYPE.Relation,
    model: 'ChatRoom'
  },
  readBy: [{
    type: TYPE.Relation,
    model: 'User',
    default: []
  }],
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
const collectionName = undefined;

export class ChatMessage extends ConduitActiveSchema<ChatMessage> {
  private static _instance: ChatMessage;
  _id!: string;
  message!: string;
  senderUser!: string | User;
  room!: string | ChatRoom;
  readBy!: string[] | User[];
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ChatMessage.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ChatMessage._instance) return ChatMessage._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ChatMessage._instance = new ChatMessage(database);
    return ChatMessage._instance;
  }
}
