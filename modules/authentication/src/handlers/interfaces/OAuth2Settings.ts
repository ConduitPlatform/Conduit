export interface OAuth2Settings {
  providerName: string;
  authorizeUrl: string;
  tokenUrl: string;
  callbackUrl: string;
  scope?: string;
  response_type?: string;
  appId: string;
  appSecret: string;
  state?: string;
  grant_type?:string;
  accessTokenMethod: string;
}