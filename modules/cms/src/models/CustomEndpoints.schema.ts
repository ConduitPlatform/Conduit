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
  },
  operation: {
    type: TYPE.Number,
    required: true,
  },
  selectedSchema: {
    type: TYPE.ObjectId,
    required: false,
  },
  selectedSchemaName: {
    type: TYPE.String,
    required: true,
  },
  inputs: [
    {
      type: TYPE.JSON,
    },
  ],
  returns: {
    type: TYPE.JSON,
    required: true,
  },
  enabled: {
    type: TYPE.Boolean,
    default: true,
  },
  authentication: {
    type: TYPE.Boolean,
    default: false,
  },
  paginated: {
    type: TYPE.Boolean,
    default: false,
  },
  sorted: {
    type: TYPE.Boolean,
    default: false,
  },
  queries: { // succeeded by 'query'
    type: [TYPE.JSON],
  },
  query: TYPE.JSON,
  assignments: [TYPE.JSON],
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

export class CustomEndpoints extends ConduitActiveSchema<CustomEndpoints> {
  private static _instance: CustomEndpoints;
  _id!: string;
  name!: string;
  operation!: number;
  selectedSchema!: string;
  selectedSchemaName!: string;
  inputs!: any[];
  returns!: any;
  enabled!: boolean;
  authentication!: boolean;
  paginated!: boolean;
  sorted!: boolean;
  queries?: any[]; // succeeded by 'query'
  query?: any;
  assignments!: any[];
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, CustomEndpoints.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (CustomEndpoints._instance) return CustomEndpoints._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    CustomEndpoints._instance = new CustomEndpoints(database);
    return CustomEndpoints._instance;
  }
}
