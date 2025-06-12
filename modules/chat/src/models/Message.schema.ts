import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { ChatRoom } from './ChatRoom.schema.js';
import { User } from './User.model.js';
import { MessageType } from '../enums/messageType.enum.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  messageType: {
    type: TYPE.String,
    enum: ['text', 'file', 'typing', 'multimedia'],
    default: 'text',
  },
  message: {
    type: TYPE.String,
    required: true,
  },
  files: [
    {
      type: TYPE.Relation,
      model: 'File',
    },
  ],
  senderUser: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  room: {
    type: TYPE.Relation,
    model: 'ChatRoom',
    required: true,
  },
  readBy: [
    {
      type: TYPE.Relation,
      model: 'User',
      required: true,
    },
  ],
  deleted: {
    type: TYPE.Boolean,
    default: false,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const modelOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: true,
      canCreate: false,
      canModify: 'ExtensionOnly',
      canDelete: false,
    },
  },
} as const;
const collectionName = undefined;

export class ChatMessage extends ConduitActiveSchema<ChatMessage> {
  private static _instance: ChatMessage;
  _id: string;
  message: string;
  messageType: MessageType;
  files: string[];
  senderUser: string | User;
  room: string | ChatRoom;
  readBy: string[] | User[];
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ChatMessage.name, schema, modelOptions, collectionName);
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
