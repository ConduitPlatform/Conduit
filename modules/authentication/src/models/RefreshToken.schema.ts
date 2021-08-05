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
  securityDetails: {
    macAddress: { type: TYPE.String, systemRequired: true },
    userAgent: { type: TYPE.String, systemRequired: true },
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
const collectionName = undefined;

export class RefreshToken extends ConduitActiveSchema<RefreshToken> {
  private static _instance: RefreshToken;
  _id: string;
  userId: string | User;
  clientId: string;
  token: string;
  expiresOn: Date;
  securityDetails: {
    macAddress: string;
    userAgent: string;
  };
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, RefreshToken.name, schema, schemaOptions, collectionName);
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
