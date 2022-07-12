import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  moduleConfigs: {
    type: TYPE.JSON,
    default: {},
    required: true,
  },
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
const collectionName = 'cnd_configs';

export class Config extends ConduitActiveSchema<Config> {
  private static _instance: Config;
  _id!: string;
  moduleConfigs!: any;

  private constructor(database: DatabaseProvider) {
    super(database, Config.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Config._instance) return Config._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Config._instance = new Config(database);
    return Config._instance;
  }

  static getPlainSchema() {
    return {
      name: Config.getInstance().name,
      fields: Config.getInstance().fields,
      schemaOptions: Config.getInstance().schemaOptions,
      collectionName: Config.getInstance().collectionName,
    };
  }
}
