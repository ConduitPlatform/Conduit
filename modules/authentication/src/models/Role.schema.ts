import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { Group } from './Group.schema';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  group: {
    type: TYPE.Relation,
    model: 'Group',
    required: true,
  },
  isDefault: {
    type: TYPE.Boolean,
    default: false,
  },
  permissions: {
    canInvite: {
      type: TYPE.Boolean,
      default: false,
    },
    canEditRoles: {
      type: TYPE.Boolean,
      default: false,
    },
    canRemove: {
      type: TYPE.Boolean,
      default: false,
    },
    canDeleteGroup: {
      type: TYPE.Boolean,
      default: false,
    },
    canCreateGroup: {
      type: TYPE.Boolean,
      default: false,
    },
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
const collectionName = undefined;

export class Role extends ConduitActiveSchema<Role> {
  private static _instance: Role;
  _id: string;
  name: string;
  group: string | Group;
  isDefault: boolean;
  permissions: {
    canInvite: boolean;
    canRemove: boolean;
    canDeleteGroup: boolean;
    canCreateGroup: boolean;
  };
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, Role.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Role._instance) return Role._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Role._instance = new Role(database);
    return Role._instance;
  }
}
