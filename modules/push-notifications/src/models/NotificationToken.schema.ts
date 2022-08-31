import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
  PlatformTypesEnum,
} from '@conduitplatform/grpc-sdk';
import { User } from './User.model';

const schema = {
  _id: TYPE.ObjectId,
  userId: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  token: {
    type: TYPE.String,
    required: true,
  },
  platform: {
    type: TYPE.String,
    enum: Object.values(PlatformTypesEnum),
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

export class NotificationToken extends ConduitActiveSchema<NotificationToken> {
  private static _instance: NotificationToken;
  _id!: string;
  userId!: string | User;
  token!: string;
  platform!: string | PlatformTypesEnum;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, NotificationToken.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (NotificationToken._instance) return NotificationToken._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    NotificationToken._instance = new NotificationToken(database);
    return NotificationToken._instance;
  }
}
