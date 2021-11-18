import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
    unique: true,
    systemRequired: true,
  },
  fields: {
    type: TYPE.JSON,
    required: true,
    systemRequired: true,
  },
  forwardTo: {
    type: TYPE.String,
    required: true,
    systemRequired: true,
  },
  emailField: {
    type: TYPE.String,
  },
  enabled: {
    type: TYPE.Boolean,
    default: true,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
const collectionName = undefined;

export class Forms extends ConduitActiveSchema<Forms> {
  private static _instance: Forms;
  _id!: string;
  name!: string;
  fields!: any;
  forwardTo!: string;
  emailField!: string;
  enabled!: boolean;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Forms.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Forms._instance) return Forms._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Forms._instance = new Forms(database);
    return Forms._instance;
  }
}
