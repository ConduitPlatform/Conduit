import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
    unique: true,
  },
  fields: {
    type: TYPE.JSON,
    required: true,
  },
  forwardTo: {
    type: TYPE.String,
    required: true,
  },
  emailField: {
    // name of dynamically specified email field in Forms.fields
    type: TYPE.String,
    required: true,
  },
  enabled: {
    type: TYPE.Boolean,
    default: true,
    required: true,
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
    super(database, Forms.name, schema, modelOptions, collectionName);
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
