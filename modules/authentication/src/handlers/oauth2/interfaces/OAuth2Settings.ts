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
  codeChallengeMethod?: string;
  codeChallenge?: string;
  codeVerifier?: string;

  constructor(
    providerConfig: ProviderConfig,
    providerParams: {
      accessTokenMethod: string;
      grantType?: string;
      authorizeUrl: string;
      tokenUrl: string;
      responseType: string;
      responseMode?: string;
      codeChallengeMethod?: string;
      codeChallenge?: string;
      codeVerifier?: string;
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
    this.codeChallengeMethod = providerParams.codeChallengeMethod;
    this.codeChallenge = providerParams.codeChallenge;
    this.codeVerifier = providerParams.codeVerifier;
  }

  set provider(providerName: string) {
    this.providerName = providerName;
    this.callbackUrl = `/hook/authentication/${this.providerName}`;
  }
}
