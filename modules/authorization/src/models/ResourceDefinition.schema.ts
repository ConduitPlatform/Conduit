import { DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
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
   * how it would be stored:
   * relations:{
   *   company: 'Company' // same as the name of the Resource
   *   or
   *   owner: ['User', 'Company'] // array of resources
   * }
   *
   */
  relations: {
    type: TYPE.JSON,
    required: false,
  },
  /**
   * {
   *   "read": ["role1", "role2"], || "read": "*"
   *   || read:[] = none
   *   || read: ["role1", "organization->read] // if in the related organization,
   *   the subject has the read permission.
   *   "write": ["role1", "role2"],
   *   "delete": ["role1", "role2"],
   *   "create": ["role1", "role2"],
   *   "customAction": ["role1", "role2"]
   * }
   */
  permissions: {
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
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
  },
} as const;
const collectionName = undefined;

export class ResourceDefinition extends ConduitActiveSchema<ResourceDefinition> {
  private static _instance: ResourceDefinition;
  _id: string;
  name: string;
  relations: { [key: string]: string[] };
  permissions: { [key: string]: string[] };
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, ResourceDefinition.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ResourceDefinition._instance) return ResourceDefinition._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ResourceDefinition._instance = new ResourceDefinition(database);
    return ResourceDefinition._instance;
  }
}
