import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  adminId: {
    type: TYPE.Relation,
    model: 'Admin',
    required: true,
  },
  hashedToken: {
    type: TYPE.String,
    required: true,
    select: false,
  },
  tokenPrefix: {
    type: TYPE.String,
    required: true,
  },
  expiresAt: {
    type: TYPE.Date,
    required: false,
  },
  lastUsedAt: {
    type: TYPE.Date,
    required: false,
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
      canModify: 'Nothing' as const,
      canDelete: false,
    },
  },
} as const;

const collectionName = undefined;

export class AdminApiToken extends ConduitActiveSchema<AdminApiToken> {
  private static _instance: AdminApiToken;
  _id!: string;
  declare name: string;
  adminId!: string;
  hashedToken!: string;
  tokenPrefix!: string;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, AdminApiToken.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (AdminApiToken._instance) return AdminApiToken._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    AdminApiToken._instance = new AdminApiToken(database);
    return AdminApiToken._instance;
  }
}
