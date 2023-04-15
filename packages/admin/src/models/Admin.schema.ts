import { DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
const schema = {
  _id: TYPE.ObjectId,
  username: {
    type: TYPE.String,
    required: true,
  },
  password: {
    type: TYPE.String,
    required: true,
    select: false,
  },
  hasTwoFA: {
    type: TYPE.Boolean,
    required: false,
  },
  isSuperAdmin: {
    type: TYPE.Boolean,
    required: true,
    default: false,
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

export class Admin extends ConduitActiveSchema<Admin> {
  private static _instance: Admin;
  _id!: string;
  username!: string;
  password!: string;
  createdAt!: Date;
  updatedAt!: Date;
  hasTwoFA?: boolean;
  isSuperAdmin!: boolean;

  private constructor(database: DatabaseProvider) {
    super(database, Admin.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Admin._instance) return Admin._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Admin._instance = new Admin(database);
    return Admin._instance;
  }
}
