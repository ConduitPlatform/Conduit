import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

/**
 * This is used to model a relation tuple like:
 * user:2131cdad reader token:123aDSA
 */
const schema = {
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
  // member
  connection: {
    type: TYPE.String,
    required: true,
  },
  // user:12312312#member@organization:123123
  computedTuple: {
    type: TYPE.String,
    required: true,
  },
  /**
   * {
   *   "user:12312312": "organization:123123#member"
   * }
   */
  actorIndex: {
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

export class Relationship extends ConduitActiveSchema<Relationship> {
  private static _instance: Relationship;
  _id: string;
  resource: string;
  resourceId: string;
  subject: string;
  computedTuple: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, Relationship.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Relationship._instance) return Relationship._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Relationship._instance = new Relationship(database);
    return Relationship._instance;
  }
}
