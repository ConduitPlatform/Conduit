import { DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User } from './User.schema';

const schema = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  secret: {
    type: TYPE.String,
    required: true,
  },
  uri: {
    type: TYPE.String,
    required: true,
  },
  qr: {
    type: TYPE.String,
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

export class TwoFactorSecret extends ConduitActiveSchema<TwoFactorSecret> {
  private static _instance: TwoFactorSecret;
  _id: string;
  user: string | User;
  secret: string;
  uri: string;
  qr: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, TwoFactorSecret.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (TwoFactorSecret._instance) return TwoFactorSecret._instance;
    if (!database) throw new Error('No database instance provided!');

    TwoFactorSecret._instance = new TwoFactorSecret(database);
    return TwoFactorSecret._instance;
  }
}
