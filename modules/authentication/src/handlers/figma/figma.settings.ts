import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export class FigmaSettings implements OAuth2Settings {
  accessTokenMethod = 'POST';
  accountLinking: boolean;
  authorizeUrl = 'https://www.figma.com/oauth?';
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName = 'figma';
  tokenUrl = 'https://www.figma.com/api/oauth/token';
  responseType = 'code';
  grantType = 'authorization_code';

  constructor(config: any, serverUrl: string) {
    this.clientId = config.figma.clientId;
    this.callbackUrl = serverUrl + '/hook/authentication/figma';
    this.clientSecret = config.figma.clientSecret;
    this.finalRedirect = config.figma.redirect_uri;
    this.accountLinking = config.figma.accountLinking;
  }
}
