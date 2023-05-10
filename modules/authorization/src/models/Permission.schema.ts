import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

/**
 * This is used to model a permission tuple like:
 * user:2131cdad reader token:123aDSA
 * this affects only granted permissions and not inherited ones
 */
const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  // organization:123123
  resource: {
    type: TYPE.String,
    required: true,
  },
  // user:1adasdas
  subject: {
    type: TYPE.String,
    required: true,
  },
  // member relation: "owner"
  permission: {
    type: TYPE.String,
    required: true,
  },
  // user:12312312#read@organization:123123
  computedTuple: {
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
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
  },
} as const;
const collectionName = undefined;

export class Permission extends ConduitActiveSchema<Permission> {
  private static _instance: Permission;
  _id: string;
  resource: string;
  subject: string;
  permission: string;
  computedTuple: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, Permission.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Permission._instance) return Permission._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Permission._instance = new Permission(database);
    return Permission._instance;
  }
}
