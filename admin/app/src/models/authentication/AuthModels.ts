export interface AuthUser {
  active: boolean;
  createdAt: string;
  email: string;
  isVerified: boolean;
  phoneNumber: string;
  updatedAt: string;
  hasTwoFA?: boolean;
  _id: string;
}

export interface AuthUserUI {
  Active: boolean;
  Email: string;
  'Registered At': string;
  Verified: boolean;
  _id: string;
}

export interface LocalTypes {
  enabled: boolean;
  sendVerificationEmail: boolean;
  verificationRequired: boolean;
  identifier: string;
  verification_redirect_uri: string;
  forgot_password_redirect_uri: string;
}

export interface GoogleTypes {
  enabled: boolean;
  accountLinking: boolean;
  clientId: string;
}

export interface FacebookTypes {
  enabled: boolean;
  accountLinking: boolean;
  clientId: string;
}

export interface TwitchTypes {
  enabled: boolean;
  clientId: string;
  accountLinking: boolean;
  redirect_uri: string;
  clientSecret: string;
}

export type SocialNameTypes = 'local' | 'google' | 'facebook' | 'twitch';

export type SocialDataTypes = LocalTypes | GoogleTypes | FacebookTypes | TwitchTypes;

export interface ServiceAccount {
  active: boolean;
  createdAt: string;
  hashedToken: string;
  name: string;
  updatedAt: string;
  _id: string;
}

export interface SettingsStateTypes {
  active: boolean;
  generateRefreshToken: boolean;
  rateLimit: number;
  tokenInvalidationPeriod: number;
  refreshTokenInvalidationPeriod: number;
  jwtSecret: string;
  showSecret?: boolean;
}

export interface SignInMethods {
  active: boolean;
  generateRefreshToken: boolean;
  jwtSecret: string;
  rateLimit: number;
  refreshTokenInvalidationPeriod: number;
  tokenInvalidationPeriod: number;
  twofa: { enabled: boolean };
  service: { enabled: boolean };
  facebook: FacebookTypes;
  google: GoogleTypes;
  local: LocalTypes;
  twitch: TwitchTypes;
}
