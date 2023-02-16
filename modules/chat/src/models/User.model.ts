import {
  ConduitActiveSchema,
  DatabaseProvider,
  Indexable,
} from '@conduitplatform/grpc-sdk';

interface AuthProvider {
  id: string;
  token: string;
  tokenExpires?: Date;
  data: Indexable;
}

export class User extends ConduitActiveSchema<User> {
  private static _instance: User;
  _id: string;
  email: string;
  hashedPassword?: string;
  google?: AuthProvider;
  facebook?: AuthProvider;
  twitch?: AuthProvider & { profile_image_url?: string };
  slack?: AuthProvider;
  figma?: AuthProvider;
  microsoft?: AuthProvider;
  github?: AuthProvider;
  active: boolean;
  isVerified: boolean;
  hasTwoFA: boolean;
  twoFaMethod: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;

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
