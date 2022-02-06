import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/conduit-grpc-sdk';
import { User } from './User.model'

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  participants: [{
    type: TYPE.Relation,
    model: 'User',
    required: true,
  }],
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: true,
      canCreate: false,
      canModify: 'ExtensionOnly',
      canDelete: false,
    },
  },
};
const collectionName = undefined;

export class ChatRoom extends ConduitActiveSchema<ChatRoom> {
  private static _instance: ChatRoom;
  _id!: string;
  name!: string;
  participants!: string[] | User[];
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ChatRoom.name, schema, schemaOptions, collectionName);
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
