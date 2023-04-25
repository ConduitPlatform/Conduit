import { DatabaseProvider, PlatformTypesEnum, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

import { User } from './User.model';

const schema = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  title: {
    type: TYPE.String,
    required: true,
  },
  body: TYPE.String,
  data: TYPE.JSON,
  platform: {
    type: TYPE.String,
    enum: Object.values(PlatformTypesEnum),
    required: false,
  },
  read: {
    type: TYPE.Boolean,
    default: false,
  },
  readAt: TYPE.Date,
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

export class Notification extends ConduitActiveSchema<Notification> {
  private static _instance: Notification;
  _id!: string;
  user!: string | User;
  title!: string;
  body?: string;
  data?: any;
  read?: boolean;
  readAt?: Date;
  platform?: string | PlatformTypesEnum;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Notification.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Notification._instance) return Notification._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Notification._instance = new Notification(database);
    return Notification._instance;
  }
}
