export interface OAuth2Settings {
  providerName: string;
  authorizeUrl: string;
  tokenUrl: string;
  callbackUrl: string;
  finalRedirect: string;
  accountLinking: boolean;
  clientId: string;
  clientSecret: string;
  accessTokenMethod: string;
  grantType?: string;
  state?: string;
  scope?: string;
  responseType?: string;
  scopeSeperator?: string;
}
