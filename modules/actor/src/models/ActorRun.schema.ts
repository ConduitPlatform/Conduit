import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { ActorFlows } from './ActorFlow.schema';

const schema = {
  _id: TYPE.ObjectId,
  flow: {
    type: TYPE.Relation,
    model: 'ActorFlow',
    required: true,
    systemRequired: true,
  },
  data: {
    type: TYPE.JSON,
    required: false,
    systemRequired: true,
  },
  status: {
    type: TYPE.String,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
const collectionName = undefined;

export class ActorRuns extends ConduitActiveSchema<ActorRuns> {
  private static _instance: ActorRuns;
  _id!: string;
  flow!: string | ActorFlows;
  data!: any;
  status!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ActorRuns.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ActorRuns._instance) return ActorRuns._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ActorRuns._instance = new ActorRuns(database);
    return ActorRuns._instance;
  }
}
