import {
  ConduitActiveSchema,
  DatabaseProvider,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';

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
    data: {
      type: TYPE.JSON,
    },
  },
  microsoft: {
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
  },
  figma: {
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
  },
  slack: {
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
  },
  facebook: {
    id: {
      type: TYPE.String,
    },
    token: {
      type: TYPE.String,
    },
    tokenExpires: {
      type: TYPE.String,
    },
    data: {
      type: TYPE.JSON,
    },
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
    data: {
      type: TYPE.JSON,
    },
    profile_image_url: TYPE.String,
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
  phoneNumber: TYPE.String,
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
} as const;
const collectionName = 'cnd_users';

export class User extends ConduitActiveSchema<User> {
  private static _instance: User;
  _id: string;
  email: string;
  hashedPassword?: string;
  google?: {
    id: string;
    token: string;
    tokenExpires: Date;
    data: Indexable;
  };
  facebook?: {
    id: string;
    token: string;
    //tokenExpires: string;
    data: Indexable;
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
    data: Indexable;
  };
  slack?: {
    id: string;
    token: string;
    tokenExpires: Date;
    data: Indexable;
  };
  figma?: {
    id: string;
    token: string;
    tokenExpires: Date;
    data: Indexable;
  };
  microsoft?: {
    id: string;
    token: string;
    tokenExpires: Date;
    data: Indexable;
  };
  github?: {
    id: string;
    token: string;
    tokenExpires: Date;
    data: Indexable;
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
