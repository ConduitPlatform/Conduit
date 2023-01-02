import {
  ConduitActiveSchema,
  DatabaseProvider,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { IInputsInterface } from '../interfaces/IInputs.interface';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  code: {
    type: TYPE.String,
    required: true,
  },
  inputs: {
    type: TYPE.JSON,
    required: false,
  },
  returns: {
    type: TYPE.JSON,
    required: false,
  },
  timeout: {
    type: TYPE.Number,
    default: 180000,
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

export class FunctionEndpoints extends ConduitActiveSchema<FunctionEndpoints> {
  private static _instance: FunctionEndpoints;
  _id!: string;
  name!: string;
  code!: string;

  inputs!: IInputsInterface;

  returns?: Indexable;

  timeout!: number;

  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, FunctionEndpoints.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (FunctionEndpoints._instance) return FunctionEndpoints._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    FunctionEndpoints._instance = new FunctionEndpoints(database);
    return FunctionEndpoints._instance;
  }
}
