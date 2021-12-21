import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

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
  google: {
    id: {
      type: TYPE.String,
    },
    token: {
      type: TYPE.String,
    },
    tokenExpires: {
      type: TYPE.Date,
    },
  },
  facebook: {
    id: {
      type: TYPE.String,
    },
    token: {
      type: TYPE.String,
    },
    // tokenExpires: {
    //   type: TYPE.String,
    // },
  },
  kakao: {
    id: {
      type: TYPE.String,
    },
    token: {
      type: TYPE.String,
    },
    tokenExpires: {
      type: TYPE.String,
    },
    profile_image_url: TYPE.String,
    thumbnail_image_url: TYPE.String,
  },
  twitch: {
    id: {
      type: TYPE.String,
    },
    token: {
      type: TYPE.String,
    },
    tokenExpires: {
      type: TYPE.String,
    },
    profile_image_url: TYPE.String,
  },
  active: {
    type: TYPE.Boolean,
    default: true,
  },
  isVerified: {
    type: TYPE.Boolean,
    default: false,
  },
  hasTwoFA: {
    type: TYPE.Boolean,
    default: false,
  },
  phoneNumber: TYPE.String,
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: true,
      canCreate: true,
      canModify: 'Everything',
      canDelete: true,
    },
  },
};
const collectionName = undefined;

export class User extends ConduitActiveSchema<User> {
  private static _instance: User;
  _id: string;
  email: string;
  hashedPassword?: string;
  google?: {
    id: string;
    token: string;
    tokenExpires: Date;
  };
  facebook?: {
    id: string;
    token: string;
    // tokenExpires: string;
  };
  kakao?: {
    id: string;
    token: string;
    tokenExpires: string;
    profile_image_url?: string;
    thumbnail_image_url?: string;
  };
  twitch?: {
    id: string;
    token: string;
    tokenExpires: string;
    profile_image_url?: string;
  };
  active: boolean;
  isVerified: boolean;
  hasTwoFA: boolean;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
    super(database, User.name, schema, schemaOptions, collectionName);
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
