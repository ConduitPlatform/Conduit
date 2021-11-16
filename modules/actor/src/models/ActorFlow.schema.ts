import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
    unique: true,
    systemRequired: true,
  },
  trigger: {
    type: {
      code: TYPE.String,
      name: TYPE.String,
      comments: TYPE.String,
      options: TYPE.JSON,
    },
    required: true,
    systemRequired: true,
  },
  actors: {
    type: [
      {
        code: TYPE.String,
        name: TYPE.String,
        comments: TYPE.String,
        options: TYPE.JSON,
      },
    ],
    required: true,
    systemRequired: true,
  },
  enabled: {
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

export class ActorFlow extends ConduitActiveSchema<ActorFlow> {
  private static _instance: ActorFlow;
  _id!: string;
  name!: string;
  trigger!: {
    code: string;
    name: string;
    comments: string;
    options: any;
  };
  actors!: {
    code: string;
    name: string;
    comments: string;
    options: any;
  }[];
  enabled!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ActorFlow.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ActorFlow._instance) return ActorFlow._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ActorFlow._instance = new ActorFlow(database);
    return ActorFlow._instance;
  }
}
