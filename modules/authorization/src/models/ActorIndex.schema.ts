import { DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

/**
 * This is used to model a relation tuple like:
 * user:2131cdad reader token:123aDSA
 */
const schema = {
  _id: TYPE.ObjectId,
  /**
   * {
   *   "user:12312312": "organization:123123#member"
   * }
   */
  subject: {
    type: TYPE.String,
    required: true,
  },
  entity: {
    type: TYPE.String,
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

export class ActorIndex extends ConduitActiveSchema<ActorIndex> {
  private static _instance: ActorIndex;
  _id: string;
  subject: string;
  entity: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
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
