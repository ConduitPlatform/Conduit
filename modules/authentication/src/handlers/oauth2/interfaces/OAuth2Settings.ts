import { ProviderConfig } from './ProviderConfig';

export class OAuth2Settings {
  providerName: string;
  authorizeUrl: string;
  tokenUrl: string;
  callbackUrl: string;
  finalRedirect: string;
  accountLinking: boolean;
  clientId: string;
  clientSecret: string;
  accessTokenMethod: 'GET' | 'POST';
  grantType?: string;
  state?: string;
  scope?: string;
  responseType?: string;
  scopeSeperator?: string;
  privateKey?: string;

  constructor(
    private readonly serverUrl: string,
    providerConfig: ProviderConfig,
    providerParams: {
      accessTokenMethod: string;
      grantType?: string;
      authorizeUrl: string;
      tokenUrl: string;
      responseType: string;
    },
  ) {
    this.accountLinking = providerConfig.accountLinking;
    this.clientId = providerConfig.clientId;
    this.clientSecret = providerConfig.clientSecret;
    this.finalRedirect = providerConfig.redirect_uri;
    this.accessTokenMethod = providerParams.accessTokenMethod === 'GET' ? 'GET' : 'POST';
    this.authorizeUrl = providerParams.authorizeUrl;
    this.tokenUrl = providerParams.tokenUrl;
    this.grantType = providerParams.grantType;
    this.responseType = providerParams.responseType;
    this.privateKey = providerConfig.privateKey;
  }

  set provider(providerName: string) {
    this.providerName = providerName;
    this.callbackUrl = `${this.serverUrl}/hook/authentication/${this.providerName}`;
  }
}
