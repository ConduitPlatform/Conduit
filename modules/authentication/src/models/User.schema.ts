import { DatabaseProvider, Indexable, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

interface AuthProviderBase {
  id: string;
  token: string;
  tokenExpires?: Date;
  data: Indexable;
}

const authProviderSchema = {
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

const schema = {
  _id: TYPE.ObjectId,
  // do not add unique again, since this will fail due to emails being null
  email: {
    type: TYPE.String,
    required: false,
  },
  hashedPassword: {
    type: TYPE.String,
    select: false,
  },
  github: {
    ...authProviderSchema,
  },
  google: {
    ...authProviderSchema,
  },
  microsoft: {
    ...authProviderSchema,
  },
  figma: {
    ...authProviderSchema,
  },
  slack: {
    ...authProviderSchema,
  },
  facebook: {
    ...authProviderSchema,
  },
  twitch: {
    ...authProviderSchema,
    profile_image_url: TYPE.String,
    my_object: {
      test: TYPE.String,
    },
    my_second_object: {
      test_me_sir: TYPE.String,
    },
    my_third_object: {
      my_object: {
        test: TYPE.String,
      },
    },
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
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
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
