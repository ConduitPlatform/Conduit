import {
  Admin,
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  adminId: {
    type: TYPE.Relation,
    model: 'Admin',
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

export class AdminTwoFactorSecret extends ConduitActiveSchema<AdminTwoFactorSecret> {
  private static _instance: AdminTwoFactorSecret;
  _id: string;
  adminId: string | Admin;
  secret: string;
  uri: string;
  qr: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, AdminTwoFactorSecret.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (AdminTwoFactorSecret._instance) return AdminTwoFactorSecret._instance;
    if (!database) throw new Error('No database instance provided!');

    AdminTwoFactorSecret._instance = new AdminTwoFactorSecret(database);
    return AdminTwoFactorSecret._instance;
  }
}
