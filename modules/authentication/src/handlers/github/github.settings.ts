import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export class GithubSettings implements OAuth2Settings {
  accessTokenMethod = 'POST';
  accountLinking: boolean;
  authorizeUrl = 'https://github.com/login/oauth/authorize?';
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName = 'github';
  tokenUrl = 'https://github.com/login/oauth/access_token';
  responseType = 'code';

  constructor(config: any, serverUrl: string) {
    this.clientId = config.github.clientId;
    this.clientSecret = config.github.clientSecret;
    this.callbackUrl = serverUrl + '/hook/authentication/github';
    this.finalRedirect = config.github.redirect_uri;
    this.accountLinking = config.github.accountLinking;
  }
}
