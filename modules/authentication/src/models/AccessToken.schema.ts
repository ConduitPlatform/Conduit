import {
  CompatibleIndexType,
  ConduitModel,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User } from './index.js';

const schema: ConduitModel = {
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

export class AccessToken extends ConduitActiveSchema<AccessToken> {
  private static _instance: AccessToken;
  _id: string;
  user: string | User;
  clientId: string;
  realm?: string;
  token: string;
  expiresOn: Date;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, AccessToken.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (AccessToken._instance) return AccessToken._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    AccessToken._instance = new AccessToken(database);
    return AccessToken._instance;
  }
}
