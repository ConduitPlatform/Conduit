import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

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
  modelOptions: { type: TYPE.String, systemRequired: true },
  ownerModule: {
    type: TYPE.String,
    required: true,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
const collectionName = undefined;

export class DeclaredSchema extends ConduitActiveSchema<DeclaredSchema> {
  private static _instance: DeclaredSchema;
  _id!: string;
  name!: string;
  fields!: any;
  modelOptions!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, DeclaredSchema.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (DeclaredSchema._instance) return DeclaredSchema._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    DeclaredSchema._instance = new DeclaredSchema(database);
    return DeclaredSchema._instance;
  }
}
