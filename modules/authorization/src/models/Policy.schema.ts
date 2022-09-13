import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: false,
  },
  description: {
    type: TYPE.String,
    required: false,
  },
  policyType: {
    type: TYPE.String,
    enum: ['RBAC', 'ABAC'],
  },
  /**
   * Valid rules
   * {
   * "or":[
   *   {
   *    condition: {
   *      "and:[{
   *    type: "Role"
   *    is: "Editor"
   *    on: "_resource.team.parent"
   *   },{
   *    type: "Attribute"
   *    left: "user._id"
   *    expression: "eq"
   *    right: "resource.owner"
   *   },{
   *    type: "Attribute"
   *    left: "resource.company"
   *    expression: "eq"
   *    right: "resource.owner"
   *   }]
   *   access: "fields"
   *   fields: ["name", "address"]
   *    }
   *   },
   *   {
   *     or:[{
   *       type: "Role",
   *       is: "Editor",
   *       on: ab123xca
   *     }]
   *
   *   }
   * ]
   *
   * }
   */
  rules: [
    {
      expression: TYPE.JSON,
      fieldAccess: [
        {
          type: TYPE.String,
        },
      ],
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
