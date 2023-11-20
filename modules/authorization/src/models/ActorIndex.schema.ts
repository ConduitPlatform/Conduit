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
   *    subject         entity
   *   "user:12312312": "organization:123123#member"
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
    type: TYPE.String,
    default: '',
    required: true,
  },
  // user
  subjectType: {
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
    type: TYPE.String,
    default: '',
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

export class ActorIndex extends ConduitActiveSchema<ActorIndex> {
  private static _instance: ActorIndex;
  _id: string;
  subject: string;
  subjectId: string;
  subjectType: string;
  entity: string;
  entityId: string;
  entityType: string;
  relation: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ActorIndex.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ActorIndex._instance) return ActorIndex._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ActorIndex._instance = new ActorIndex(database);
    return ActorIndex._instance;
  }
}
