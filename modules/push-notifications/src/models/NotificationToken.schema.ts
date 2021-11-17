import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
  PlatformTypesEnum,
} from '@quintessential-sft/conduit-grpc-sdk';
import { User } from './User.model';

const schema = {
  _id: TYPE.ObjectId,
  userId: {
    type: TYPE.Relation,
    model: 'User',
    systemRequired: true,
  },
  token: {
    type: TYPE.String,
    required: true,
    systemRequired: true,
  },
  platform: {
    type: TYPE.String,
    enum: Object.values(PlatformTypesEnum),
    required: true,
    systemRequired: true,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
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
    super(database, NotificationToken.name, schema, schemaOptions, collectionName);
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
