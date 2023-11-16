import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User } from './User.model';

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
      type: {
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
        timestamp: {
          type: TYPE.Date,
          required: true,
        },
      },
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
  name: string;
  creator: string | User;
  participants: string[] | User[];
  participantsLog: {
    action: 'add' | 'remove' | 'create' | 'join' | 'leave';
    user: string | User;
    timestamp: Date;
  }[];
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
