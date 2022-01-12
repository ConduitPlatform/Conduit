import {
  ConduitActiveSchema,
  DatabaseProvider,
} from '@quintessential-sft/conduit-grpc-sdk';

// NOTICE:
// User.model is just a reference to the database module's User schema.

export class User extends ConduitActiveSchema<User> {
  private static _instance: User;
  _id!: string;
  email!: string;
  hashedPassword?: string;
  google?: {
    id: string;
    token: string;
    tokenExpires: Date;
  };
  facebook?: {
    id: string;
    token: string;
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
  active!: boolean;
  isVerified!: boolean;
  hasTwoFA!: boolean;
  phoneNumber?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(database: DatabaseProvider) {
    // NOTICE:
    // In contrast to the CustomModule-owned Foobar.schema,
    // we only provide the base constructor with a database instance and the schema's name
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
