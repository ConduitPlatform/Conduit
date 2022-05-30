import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export class SlackSettings implements OAuth2Settings {
  accessTokenMethod = 'POST';
  accountLinking: boolean;
  authorizeUrl = 'https://slack.com/oauth/authorize?';
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName = 'slack';
  tokenUrl = 'https://slack.com/api/oauth.access';
  responseType = 'code';

  constructor(config: any, serverUrl: string) {
    this.clientId = config.slack.clientId;
    this.callbackUrl = serverUrl + '/hook/authentication/slack';
    this.clientSecret = config.slack.clientSecret;
    this.finalRedirect = config.slack.redirect_uri;
    this.accountLinking = config.slack.accountLinking;
  }

}
