import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';

export class GithubSettings implements OAuth2Settings {
  accessTokenMethod: string;
  accountLinking: boolean;
  authorizeUrl: string;
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName: string;
  tokenUrl: string;
  responseType: string;

  constructor(grpcSdk: ConduitGrpcSdk, config: any, serverUrl: string) {
    this.providerName = 'github';
    this.clientId = config.github.clientId;
    this.clientSecret = config.github.clientSecret;
    this.callbackUrl = serverUrl + '/hook/authentication/github';
    this.responseType = 'code';
    this.accessTokenMethod = 'POST';
    this.finalRedirect = config.github.redirect_uri;
    this.accountLinking = config.github.accountLinking;
    this.authorizeUrl = 'https://github.com/login/oauth/authorize?';
    this.tokenUrl = 'https://github.com/login/oauth/access_token';
  }
}
