import {
  ConduitModel,
  DatabaseProvider,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

interface AuthProviderBase {
  id: string;
  token: string;
  tokenExpires?: Date;
  data: Indexable;
}

const authProviderSchema: ConduitModel = {
  id: {
    type: TYPE.String,
  },
  token: {
    type: TYPE.String,
  },
  tokenExpires: {
    type: TYPE.Date,
  },
  data: {
    type: TYPE.JSON,
  },
};

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  // do not add unique again, since this will fail due to emails being null
  email: {
    type: TYPE.String,
    required: false,
  },
  username: {
    type: TYPE.String,
    required: false,
  },
  ethPublicAddress: {
    type: TYPE.String,
    required: false,
  },
  nonce: {
    type: TYPE.String,
    required: false,
  },
  hashedPassword: {
    type: TYPE.String,
    select: false,
  },
  apple: {
    ...authProviderSchema,
  },
  bitbucket: {
    ...authProviderSchema,
  },
  facebook: {
    ...authProviderSchema,
  },
  figma: {
    ...authProviderSchema,
  },
  github: {
    ...authProviderSchema,
  },
  gitlab: {
    ...authProviderSchema,
  },
  google: {
    ...authProviderSchema,
  },
  linkedin: {
    ...authProviderSchema,
  },
  microsoft: {
    ...authProviderSchema,
  },
  reddit: {
    ...authProviderSchema,
  },
  slack: {
    ...authProviderSchema,
  },
  twitch: {
    ...authProviderSchema,
  },
  twitter: {
    ...authProviderSchema,
  },
  active: {
    type: TYPE.Boolean,
    default: true,
    required: true,
  },
  isVerified: {
    type: TYPE.Boolean,
    default: false,
    required: true,
  },
  hasTwoFA: {
    type: TYPE.Boolean,
    default: false,
    required: true,
  },
  isAnonymous: {
    type: TYPE.Boolean,
    required: false,
  },
  twoFaMethod: TYPE.String,
  phoneNumber: TYPE.String,
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

export class User extends ConduitActiveSchema<User> {
  private static _instance: User;
  _id: string;
  email: string;
  username: string;
  ethPublicAddress: string;
  nonce: string;
  hashedPassword?: string;
  google?: AuthProviderBase;
  facebook?: AuthProviderBase;
  twitch?: AuthProviderBase;
  slack?: AuthProviderBase;
  figma?: AuthProviderBase;
  microsoft?: AuthProviderBase;
  github?: AuthProviderBase;
  active: boolean;
  isVerified: boolean;
  hasTwoFA: boolean;
  twoFaMethod: string;
  phoneNumber?: string;
  isAnonymous?: boolean;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, User.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (User._instance) return User._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    User._instance = new User(database);
    return User._instance;
  }
}
