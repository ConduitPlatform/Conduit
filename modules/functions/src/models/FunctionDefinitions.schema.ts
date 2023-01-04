import {
  ConduitActiveSchema,
  DatabaseProvider,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  functionName: {
    type: TYPE.String,
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

export class FunctionDefinitions extends ConduitActiveSchema<FunctionDefinitions> {
  private static _instance: FunctionDefinitions;
  _id!: string;

  functionName!: string;

  duration!: number;

  success!: boolean;

  error?: Indexable;

  logs?: string[];

  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, FunctionDefinitions.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (FunctionDefinitions._instance) return FunctionDefinitions._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    FunctionDefinitions._instance = new FunctionDefinitions(database);
    return FunctionDefinitions._instance;
  }
}
