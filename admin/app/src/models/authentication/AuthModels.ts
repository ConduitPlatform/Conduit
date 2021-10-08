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

export interface SignInTypes {
  enabled: boolean;
  accountLinking: boolean;
  sendVerificationEmail?: boolean;
  verificationRequired?: boolean;
  clientId?: string;
  identifier?: string;
  verification_redirect_uri?: string;
  forgot_password_redirect_uri?: string;
  redirect_uri?: string;
  clientSecret?: string;
}

export type SocialNameTypes = 'local' | 'google' | 'facebook' | 'twitch';

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
  facebook: SignInTypes;
  google: SignInTypes;
  local: SignInTypes;
  twitch: SignInTypes;
}
