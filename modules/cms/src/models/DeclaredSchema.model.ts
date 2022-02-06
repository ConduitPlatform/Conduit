import {
  ConduitActiveSchema,
  DatabaseProvider,
  ConduitModelOptions,
} from '@conduitplatform/conduit-grpc-sdk';

interface CmsOptions extends ConduitModelOptions {
  conduit: {
    cms: {
      enabled: boolean;
      authentication: boolean;
      crudOperations: boolean;
    };
  };
}

export class _DeclaredSchema extends ConduitActiveSchema<_DeclaredSchema> {
  private static _instance: _DeclaredSchema;
  _id!: string;
  name!: string;
  fields!: any;
  extensions!: any[];
  modelOptions!: CmsOptions;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, _DeclaredSchema.name);
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
