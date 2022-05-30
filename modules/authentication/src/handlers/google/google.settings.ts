import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export class GoogleSettings implements OAuth2Settings {
  accessTokenMethod = 'POST';
  accountLinking: boolean;
  authorizeUrl = 'https://accounts.google.com/o/oauth2/v2/auth?';
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName = 'google';
  tokenUrl = 'https://oauth2.googleapis.com/token';
  responseType = 'code';
  grantType = 'authorization_code';

  constructor(config: any, serverUrl: string) {
    this.accountLinking = config.google.accountLinking;
    this.clientId = config.google.clientId;
    this.clientSecret = config.google.clientSecret;
    this.finalRedirect = config.google.redirect_uri;
    this.callbackUrl = serverUrl + '/hook/authentication/google';
  }
}
