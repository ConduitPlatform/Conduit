import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { User } from './User.schema';
import { userTokenSchema } from '../constants';

const schema = {
  _id: TYPE.ObjectId,
  ...userTokenSchema,
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

export class AccessToken extends ConduitActiveSchema<AccessToken> {
  private static _instance: AccessToken;
  _id: string;
  user: string | User;
  clientId: string;
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
