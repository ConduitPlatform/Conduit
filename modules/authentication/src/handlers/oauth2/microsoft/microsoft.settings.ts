import { OAuth2Settings } from '../interfaces/OAuth2Settings';

export class MicrosoftSettings extends OAuth2Settings {
  responseMode: string;

  constructor(serverUrl: string, providerConfig: {
    accountLinking: boolean,
    clientId: string,
    clientSecret: string,
    redirect_uri: string
  }, providerParams: {
    accessTokenMethod: string,
    grantType?: string,
    authorizeUrl: string,
    tokenUrl: string,
    responseType: string,
    response_mode: string,
  }) {
    super(serverUrl, providerConfig, providerParams);
    this.responseMode = providerParams.response_mode;
  }
}
