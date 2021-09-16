export interface IClient {
  _id: string;
  clientId: string;
  clientSecret: string;
  platform: IPlatformTypes;
  createdAt: string;
  updatedAt: string;
}

export type IPlatformTypes =
  | 'WEB'
  | 'ANDROID'
  | 'IOS'
  | 'IPADOS'
  | 'WINDOWS'
  | 'MACOS'
  | 'LINUX';

export interface INewAdminUser {
  username: string;
  password: string;
}
