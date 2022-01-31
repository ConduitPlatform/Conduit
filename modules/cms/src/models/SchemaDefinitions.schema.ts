import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/conduit-grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    unique: true,
    required: true,
    systemRequired: true,
  },
  fields: {
    type: TYPE.JSON,
    required: true,
    systemRequired: true,
  },
  //todo The properties in JSON, replace adequetly
  modelOptions: { type: TYPE.String, systemRequired: true },
  enabled: {
    type: TYPE.Boolean,
    default: true,
    systemRequired: true,
  },
  authentication: {
    type: TYPE.Boolean,
    default: false,
  },
  crudOperations: {
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

export class SchemaDefinitions extends ConduitActiveSchema<SchemaDefinitions> {
  private static _instance: SchemaDefinitions;
  _id!: string;
  name!: string;
  fields!: any;
  enabled!: boolean;
  authentication!: boolean;
  crudOperations!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, SchemaDefinitions.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (SchemaDefinitions._instance) return SchemaDefinitions._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    SchemaDefinitions._instance = new SchemaDefinitions(database);
    return SchemaDefinitions._instance;
  }
}
