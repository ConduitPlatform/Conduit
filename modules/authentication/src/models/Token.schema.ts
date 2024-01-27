import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User } from './index.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  tokenType: {
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
  tokenType: string;
  user?: string | User;
  token: string;
  data?: any;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
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
