import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { User } from './User.schema';

const schema = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  clientId: {
    type: TYPE.String,
    required: false,
  },
  token: {
    type: TYPE.String,
    required: true,
  },
  expiresOn: {
    type: TYPE.Date,
    required: true,
  },
  securityDetails: {
    macAddress: TYPE.String,
    userAgent: TYPE.String,
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

export class RefreshToken extends ConduitActiveSchema<RefreshToken> {
  private static _instance: RefreshToken;
  _id: string;
  user: string | User;
  clientId: string;
  token: string;
  expiresOn: Date;
  securityDetails?: {
    macAddress: string;
    userAgent: string;
  };
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, RefreshToken.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (RefreshToken._instance) return RefreshToken._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    RefreshToken._instance = new RefreshToken(database);
    return RefreshToken._instance;
  }
}
