import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  // do not add unique again, since this will fail due to emails being null
  name: {
    type: TYPE.String,
    required: true,
  },
  parentGroup: {
    type: TYPE.Relation,
    model: 'Group',
    required: false,
  },
  isDefault: {
    type: TYPE.Boolean,
    default: false,
  },
  isRealm: {
    type: TYPE.Boolean,
    default: false,
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

export class Group extends ConduitActiveSchema<Group> {
  private static _instance: Group;
  _id: string;
  name: string;
  parentGroup: string | Group;
  isDefault: boolean;
  isRealm: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, Group.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Group._instance) return Group._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Group._instance = new Group(database);
    return Group._instance;
  }
}
