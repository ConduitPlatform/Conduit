import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { User } from './User.schema';

const schema = {
  _id: TYPE.ObjectId,
  type: {
    type: TYPE.String,
    required: true,
  },
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: false,
  },
  token: {
    type: TYPE.String,
    required: true,
  },
  data: {
    type: TYPE.JSON,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
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

export class Token extends ConduitActiveSchema<Token> {
  private static _instance: Token;
  _id: string;
  type: string;
  user?: string | User;
  token: string;
  data?: any;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, Token.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Token._instance) return Token._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Token._instance = new Token(database);
    return Token._instance;
  }
}
