import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  resourceType: {
    type: TYPE.String,
    enum: ['endpoint', 'collection', 'document', 'custom'],
    required: true,
  },
  // Required when resourceType is document
  schemaName: {
    // StorageFile
    type: TYPE.String,
    required: false,
  },
  // not required if resourceType is custom, will still be checked
  // if type is custom and the value is filled.
  resourceId: {
    // abdsacascasdas
    type: TYPE.String,
    required: false,
  },
  /**
   * Example:
   * Company {
   *   name: string;
   *   address: string;
   * }
   *
   * Product {
   *   company: Relation
   * }
   *
   * This field for Product would be:
   * relations :{
   *   company: abavc213acb (Company Id),
   *   relationShipType: 'parent'
   * }
   *
   *
   *     resource: {
   *       type: TYPE.Relation,
   *       model: 'Resource',
   *     },
   *     relationshipType: {
   *       type: TYPE.String,
   *       enum: ['parent', 'child'],
   *     },
   *     relationField: {
   *       type: TYPE.String,
   *     },
   *
   */
  relations: {
    type: TYPE.JSON,
    required: false,
  },
  roles: [
    {
      type: TYPE.String,
    },
  ],
  /**
   * {
   *   "read": ["role1", "role2"], || "read": "denyAll" || "read": "allowAll" || read: Policy
   *   "write": ["role1", "role2"],
   *   "delete": ["role1", "role2"],
   *   "create": ["role1", "role2"],
   *   "customAction": ["role1", "role2"]
   *   "read" : {
   *     "and": [{
   *
   *     }]
   *   }
   * }
   */
  policies: {
    type: TYPE.JSON,
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
    canEditRoles: boolean;
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
