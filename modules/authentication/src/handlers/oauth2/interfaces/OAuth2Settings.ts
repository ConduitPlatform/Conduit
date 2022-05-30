export class OAuth2Settings {
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

  constructor(private readonly serverUrl: string, providerConfig: {
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
  }) {
    this.accountLinking = providerConfig.accountLinking;
    this.clientId = providerConfig.clientId;
    this.clientSecret = providerConfig.clientSecret;
    this.finalRedirect = providerConfig.redirect_uri;
    this.accessTokenMethod = providerParams.accessTokenMethod;
    this.authorizeUrl = providerParams.authorizeUrl;
    this.tokenUrl = providerParams.tokenUrl;
    this.grantType = providerParams.grantType;
    this.responseType = providerParams.responseType;
  }

  set provider(providerName: string) {
    this.providerName = providerName;
    this.callbackUrl = `${this.serverUrl}/hook/authentication/${this.providerName}`;

  }
}
