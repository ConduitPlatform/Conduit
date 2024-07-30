import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User } from './index.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  codes: [TYPE.String],
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

export class TwoFactorBackUpCodes extends ConduitActiveSchema<TwoFactorBackUpCodes> {
  private static _instance: TwoFactorBackUpCodes;
  _id: string;
  user: string | User;
  codes: string[];
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, TwoFactorBackUpCodes.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (TwoFactorBackUpCodes._instance) return TwoFactorBackUpCodes._instance;
    if (!database) throw new Error('No database instance provided!');

    TwoFactorBackUpCodes._instance = new TwoFactorBackUpCodes(database);
    return TwoFactorBackUpCodes._instance;
  }
}
