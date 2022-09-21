import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

/**
 * This is used to model a relation tuple like:
 * user:2131cdad reader token:123aDSA
 */
const schema = {
  _id: TYPE.ObjectId,
  /**
   * {
   *   "organization:123123#view": "organization:123123#member"
   *   "organization:123123#view": "organization:123124#member"
   * }
   */
  index: {
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

export class ObjectIndex extends ConduitActiveSchema<ObjectIndex> {
  private static _instance: ObjectIndex;
  _id: string;
  index: {
    [key: string]: string;
  };
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, ObjectIndex.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ObjectIndex._instance) return ObjectIndex._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ObjectIndex._instance = new ObjectIndex(database);
    return ObjectIndex._instance;
  }
}
