import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { User } from './User.schema';

const schema = {
  _id: TYPE.ObjectId,
  userId: {
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
} as const;
const collectionName = undefined;

export class TwoFactorSecret extends ConduitActiveSchema<TwoFactorSecret> {
  private static _instance: TwoFactorSecret;
  _id: string;
  userId: string | User;
  secret: string;
  uri: string;
  qr: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, TwoFactorSecret.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (TwoFactorSecret._instance) return TwoFactorSecret._instance;
    if (!database) throw new Error('No database instance provided!');

    TwoFactorSecret._instance = new TwoFactorSecret(database);
    return TwoFactorSecret._instance;
  }
}
