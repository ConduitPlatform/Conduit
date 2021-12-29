import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { PlatformTypesEnum } from '@quintessential-sft/conduit-commons';

const schema = {
  _id: TYPE.ObjectId,
  clientId: {
    type: TYPE.String,
    unique: true,
    required: true,
    systemRequired: true,
  },
  clientSecret: {
    type: TYPE.String,
    required: true,
    select: false,
    systemRequired: true,
  },
  platform: {
    type: TYPE.String,
    enum: Object.values(PlatformTypesEnum),
    required: true,
    systemRequired: true,
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
};
const collectionName = undefined;

export class Client extends ConduitActiveSchema<Client> {
  private static _instance: Client;
  _id!: string;
  clientId!: string;
  clientSecret!: string;
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
