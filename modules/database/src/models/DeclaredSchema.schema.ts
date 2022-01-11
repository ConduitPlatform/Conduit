import {
  ConduitActiveSchema,
  DatabaseProvider,
  ConduitModelOptions,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    unique: true,
    required: true,
  },
  fields: {
    type: TYPE.JSON,
    required: true,
  },
  extensions: [
    {
      fields: {
        type: TYPE.JSON,
        required: true,
      },
      ownerModule: {
        type: TYPE.String,
        required: true,
      },
      createdAt: TYPE.Date,
      updatedAt: TYPE.Date,
    },
  ],
  modelOptions: {
    type: TYPE.JSON,
    required: true
  },
  ownerModule: {
    type: TYPE.String,
    required: true,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
  },
};
const collectionName = undefined;

export class _DeclaredSchema extends ConduitActiveSchema<_DeclaredSchema> {
  private static _instance: _DeclaredSchema;
  _id!: string;
  name!: string;
  fields!: any;
  extensions!: any[];
  modelOptions!: ConduitModelOptions;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, _DeclaredSchema.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (_DeclaredSchema._instance) return _DeclaredSchema._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    _DeclaredSchema._instance = new _DeclaredSchema(database);
    return _DeclaredSchema._instance;
  }
}
