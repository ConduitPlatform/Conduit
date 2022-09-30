import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    unique: true,
    required: true,
  },
  hashedToken: {
    type: TYPE.String,
    required: true,
  },
  active: {
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

export class Service extends ConduitActiveSchema<Service> {
  private static _instance: Service;
  _id: string;
  name: string;
  hashedToken: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Service.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Service._instance) return Service._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Service._instance = new Service(database);
    return Service._instance;
  }
}
