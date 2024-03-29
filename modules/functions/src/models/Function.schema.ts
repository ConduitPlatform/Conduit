import {
  ConduitModel,
  DatabaseProvider,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { IWebInputsInterface } from '../interfaces/IWebInputs.interface.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  functionType: {
    type: TYPE.String,
    enum: ['request', 'webhook', 'middleware', 'socket', 'event', 'cron'],
    required: true,
  },
  functionCode: {
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

export class Functions extends ConduitActiveSchema<Functions> {
  private static _instance: Functions;
  _id!: string;
  //todo rename
  declare name: string;
  functionCode!: string;
  functionType!: 'request' | 'webhook' | 'middleware' | 'socket' | 'event' | 'cron';

  inputs!: IWebInputsInterface;

  returns?: Indexable | string;

  timeout!: number;

  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Functions.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Functions._instance) return Functions._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Functions._instance = new Functions(database);
    return Functions._instance;
  }
}
