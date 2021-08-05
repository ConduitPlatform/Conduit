import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { User } from './User.schema';

const schema = {
  _id: TYPE.ObjectId,
  userId: {
    type: TYPE.Relation,
    model: 'User',
    systemRequired: true,
  },
  clientId: {
    type: TYPE.String,
    required: true,
    systemRequired: true,
  },
  token: {
    type: TYPE.String,
    systemRequired: true,
  },
  expiresOn: {
    type: TYPE.Date,
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

export class AccessToken extends ConduitActiveSchema<AccessToken> {
  private static _instance: AccessToken;
  _id: string;
  userId: string | User;
  clientId: string;
  token: string;
  expiresOn: Date;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, AccessToken.name, schema, schemaOptions, collectionName);
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
