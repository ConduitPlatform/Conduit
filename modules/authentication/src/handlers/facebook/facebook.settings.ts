import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export class FacebookSettings implements OAuth2Settings {
  accessTokenMethod = 'GET';
  accountLinking: boolean;
  authorizeUrl = 'https://www.facebook.com/v11.0/dialog/oauth?';
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName = 'facebook';
  tokenUrl  = 'https://graph.facebook.com/v12.0/oauth/access_token';
  responseType = 'code'

  constructor(config: any, serverUrl: string) {
    this.accountLinking = config.facebook.accountLinking;
    this.clientId  = config.facebook.clientId;
    this.clientSecret = config.facebook.clientSecret;
    this.finalRedirect = config.facebook.redirect_uri;
    this.callbackUrl = serverUrl + '/hook/authentication/facebook';
  }

}
