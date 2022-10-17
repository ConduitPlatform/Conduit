import {
  ConduitActiveSchema,
  DatabaseProvider,
  Indexable,
} from '@conduitplatform/grpc-sdk';

export class User extends ConduitActiveSchema<User> {
  private static _instance: User;
  _id!: string;
  email!: string;
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
    // tokenExpires: string;
    data: Indexable;
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
  active!: boolean;
  isVerified!: boolean;
  hasTwoFA!: boolean;
  twoFaMethod!: string;
  phoneNumber?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(database: DatabaseProvider) {
    super(database, 'User');
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
