import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  username: {
    type: TYPE.String,
    required: true,
  },
  password: {
    type: TYPE.String,
    required: true,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
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
const collectionName = 'cnd_admins';

export class Admin extends ConduitActiveSchema<Admin> {
  private static _instance: Admin;
  _id!: string;
  username!: string;
  password!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Admin.name, schema, schemaOptions, collectionName);
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
