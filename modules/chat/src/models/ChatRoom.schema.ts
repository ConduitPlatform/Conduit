import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User } from './User.model.js';
import { ChatParticipantsLog } from './ChatParticipantsLog.schema.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  participants: [
    {
      type: TYPE.Relation,
      model: 'User',
      required: true,
    },
  ],
  creator: {
    type: TYPE.Relation,
    model: 'User',
  },
  participantsLog: [
    {
      type: TYPE.Relation,
      model: 'ChatParticipantsLog',
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

export class ChatRoom extends ConduitActiveSchema<ChatRoom> {
  private static _instance: ChatRoom;
  _id: string;
  // todo rename
  declare name: string;
  creator?: string | User;
  participants: string[] | User[];
  participantsLog: (string | ChatParticipantsLog)[];
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ChatRoom.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ChatRoom._instance) return ChatRoom._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ChatRoom._instance = new ChatRoom(database);
    return ChatRoom._instance;
  }
}
