import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User } from './User.schema';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  publicKey: {
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
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
  },
} as const;
const collectionName = undefined;

export class BiometricToken extends ConduitActiveSchema<BiometricToken> {
  private static _instance: BiometricToken;
  _id: string;
  user: string | User;
  publicKey: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, BiometricToken.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (BiometricToken._instance) return BiometricToken._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    BiometricToken._instance = new BiometricToken(database);
    return BiometricToken._instance;
  }
}
