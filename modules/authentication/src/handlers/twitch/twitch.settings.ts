import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export class TwitchSettings implements OAuth2Settings {
  accessTokenMethod = 'POST';
  accountLinking: boolean;
  authorizeUrl = 'https://id.twitch.tv/oauth2/authorize?';
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName = 'twitch';
  tokenUrl = 'https://id.twitch.tv/oauth2/token';
  grantType = 'authorization_code';
  responseType = 'code';

  constructor(config: any, serverUrl: string) {
    this.clientId = config.twitch.clientId;
    this.callbackUrl = serverUrl + '/hook/authentication/twitch';
    this.clientSecret = config.twitch.clientSecret;
    this.finalRedirect = config.twitch.redirect_uri;
    this.accountLinking = config.twitch.accountLinking;
  };
}
