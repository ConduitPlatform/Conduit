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
  responseMode?: 'query' | 'form_post';
  scopeSeperator?: string;
  privateKey?: string;
  teamId?: string;
  keyId?: string;

  constructor(
    private readonly serverUrl: string,
    providerConfig: ProviderConfig,
    providerParams: {
      accessTokenMethod: string;
      grantType?: string;
      authorizeUrl: string;
      tokenUrl: string;
      responseType: string;
      responseMode?: string;
      privateKey?: string;
      teamId?: string;
      keyId?: string;
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
    this.responseMode =
      providerParams.responseMode === 'form_post' ? 'form_post' : 'query';
    this.privateKey = providerParams.privateKey ?? undefined;
    this.teamId = providerParams.teamId ?? undefined;
    this.keyId = providerParams.keyId ?? undefined;
  }

  set provider(providerName: string) {
    this.providerName = providerName;
    this.callbackUrl = `${this.serverUrl}/hook/authentication/${this.providerName}`;
  }
}
