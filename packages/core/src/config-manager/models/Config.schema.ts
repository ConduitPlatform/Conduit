import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  moduleConfigs: {
    type: TYPE.JSON,
    default: {},
    required: true,
  },
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

export class Config extends ConduitActiveSchema<Config> {
  private static _instance: Config;
  _id!: string;
  moduleConfigs!: any;

  private constructor(database: DatabaseProvider) {
    super(database, Config.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Config._instance) return Config._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Config._instance = new Config(database);
    return Config._instance;
  }
}
