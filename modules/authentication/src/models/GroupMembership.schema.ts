import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { User } from './User.schema';
import { Group } from './Group.schema';
import { Role } from './Role.schema';

const schema = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  group: {
    type: TYPE.Relation,
    model: 'Group',
    required: true,
  },
  roles: [
    {
      type: TYPE.Relation,
      model: 'Role',
      required: true,
    },
  ],
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

export class GroupMembership extends ConduitActiveSchema<GroupMembership> {
  private static _instance: GroupMembership;
  _id: string;
  user: string | User;
  group: string | Group;
  roles: string[] | Role[];
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, GroupMembership.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (GroupMembership._instance) return GroupMembership._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    GroupMembership._instance = new GroupMembership(database);
    return GroupMembership._instance;
  }
}
