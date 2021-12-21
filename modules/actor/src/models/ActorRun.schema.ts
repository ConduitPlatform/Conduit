import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { ActorFlow } from './ActorFlow.schema';

const schema = {
  _id: TYPE.ObjectId,
  flow: {
    type: TYPE.Relation,
    model: 'ActorFlow',
    required: true,
  },
  data: {
    type: TYPE.JSON,
    required: false,
  },
  status: {
    type: TYPE.String,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: true,
      canCreate: true,
      canModify: 'Everything',
      canDelete: true,
    },
  },
};
const collectionName = undefined;

export class ActorRun extends ConduitActiveSchema<ActorRun> {
  private static _instance: ActorRun;
  _id!: string;
  flow!: string | ActorFlow;
  data!: any;
  status!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ActorRun.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ActorRun._instance) return ActorRun._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ActorRun._instance = new ActorRun(database);
    return ActorRun._instance;
  }
}
