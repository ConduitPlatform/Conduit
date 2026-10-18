import {
  CompatibleIndexType,
  ConduitModel,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User, AccessToken } from './index.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  accessToken: {
    type: TYPE.Relation,
    model: 'AccessToken',
    required: true,
  },
  clientId: {
    type: TYPE.String,
    required: false,
  },
  // realm team id the session is in; absent = global session
  realm: {
    type: TYPE.ObjectId,
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
// non-unique: realm sweeps (demote, guest removal) delete tokens by realm
const modelOptions = {
  timestamps: true,
  indexes: [
    {
      fields: ['realm'],
      types: [CompatibleIndexType.Ascending],
    },
  ],
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
  realm?: string;
  token: string;
  accessToken: string | AccessToken;
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
