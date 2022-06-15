import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { PlatformTypesEnum } from '@conduitplatform/commons';

const schema = {
  _id: TYPE.ObjectId,
  clientId: {
    type: TYPE.String,
    unique: true,
    required: true,
  },
  clientSecret: {
    type: TYPE.String,
    required: true,
    select: false,
  },
  alias: {
    type: TYPE.String,
    unique: true,
    required: false,
  },
  notes: {
    type: TYPE.String,
    required: false,
  },
  domain: {
    type: TYPE.String,
    required: false,
  },
  platform: {
    type: TYPE.String,
    enum: Object.values(PlatformTypesEnum),
    required: true,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
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

export class Client extends ConduitActiveSchema<Client> {
  private static _instance: Client;
  _id!: string;
  clientId!: string;
  clientSecret!: string;
  alias?: string;
  notes?: string;
  domain?: string;
  platform!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Client.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Client._instance) return Client._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Client._instance = new Client(database);
    return Client._instance;
  }
}
