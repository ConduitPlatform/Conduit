import {
  ConduitModel,
  DatabaseProvider,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { Functions } from './Function.schema.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  serverlessFunction: {
    type: TYPE.Relation,
    model: Functions.name,
    required: true,
  },
  duration: {
    type: TYPE.Number,
    required: true,
  },
  success: {
    type: TYPE.Boolean,
    required: true,
  },
  error: {
    type: TYPE.JSON,
    required: false,
  },

  logs: {
    type: [TYPE.String],
    required: false,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};

const modelOptions = {
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

export class FunctionExecutions extends ConduitActiveSchema<FunctionExecutions> {
  private static _instance: FunctionExecutions;
  _id!: string;
  serverlessFunction!: string | Functions;
  duration!: number;
  success!: boolean;
  error?: Indexable;
  logs?: string[];
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, FunctionExecutions.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (FunctionExecutions._instance) return FunctionExecutions._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    FunctionExecutions._instance = new FunctionExecutions(database);
    return FunctionExecutions._instance;
  }
}
