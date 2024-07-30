import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User } from './User.model.js';
import { ChatRoom } from './ChatRoom.schema.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  action: {
    type: TYPE.String,
    enum: ['add', 'remove', 'create', 'join', 'leave'],
    required: true,
  },
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  chatRoom: {
    type: TYPE.Relation,
    model: 'ChatRoom',
    required: true,
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

export class ChatParticipantsLog extends ConduitActiveSchema<ChatParticipantsLog> {
  private static _instance: ChatParticipantsLog;
  _id: string;
  action: 'add' | 'remove' | 'create' | 'join' | 'leave';
  user: string | User;
  chatRoom: string | ChatRoom;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ChatParticipantsLog.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ChatParticipantsLog._instance) return ChatParticipantsLog._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ChatParticipantsLog._instance = new ChatParticipantsLog(database);
    return ChatParticipantsLog._instance;
  }
}
