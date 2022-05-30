import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export class MicrosoftSettings implements OAuth2Settings {
  accessTokenMethod = 'POST';
  accountLinking: boolean;
  authorizeUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?';
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName = 'microsoft';
  tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  response_mode = 'form_post';
  responseType = 'code';
  grantType = 'authorization_code';

  constructor(config: any, serverUrl: string) {
    this.clientId = config.microsoft.clientId;
    this.callbackUrl = serverUrl + '/hook/authentication/microsoft';
    this.clientSecret = config.microsoft.clientSecret;
    this.finalRedirect = config.microsoft.redirect_uri;
    this.accountLinking = config.microsoft.accountLinking;
  }
}
