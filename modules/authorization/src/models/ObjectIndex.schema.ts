import {
  ConduitModel,
  DatabaseProvider,
  MongoIndexType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

/**
 * This is used to model a relation tuple like:
 * user:2131cdad reader token:123aDSA
 */
const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  /**
   * {
   *   "organization:123123#view": "organization:123123#member"
   *   "organization:123123#view": "organization:123124#member"
   * }
   */
  subject: {
    type: TYPE.String,
    required: true,
    index: {
      type: MongoIndexType.Ascending,
    },
  },
  subjectId: {
    type: TYPE.ObjectId,
    required: true,
  },
  // organization
  subjectType: {
    type: TYPE.String,
    required: true,
    default: '',
  },
  // view
  subjectPermission: {
    type: TYPE.String,
    required: true,
    default: '',
  },
  entity: {
    type: TYPE.String,
    required: true,
    index: {
      type: MongoIndexType.Ascending,
    },
  },
  entityId: {
    type: TYPE.ObjectId,
    required: true,
  },
  // organization
  entityType: {
    type: TYPE.String,
    required: true,
    default: '',
  },
  // member
  relation: {
    type: TYPE.String,
    required: true,
    default: '',
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
  subject: string;
  subjectId: string;
  subjectType: string;
  subjectPermission: string;
  entity: string;
  entityId: string;
  entityType: string;
  relation: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
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
