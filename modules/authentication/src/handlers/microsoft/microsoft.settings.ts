import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class MicrosoftSettings implements OAuth2Settings {
  accessTokenMethod: string;
  accountLinking: boolean;
  authorizeUrl: string;
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName: string;
  tokenUrl: string;
  response_mode: string;
  responseType: string;
  grantType: string;

  constructor(grpcSdk: ConduitGrpcSdk, config: any, serverUrl: string) {
    this.providerName = 'microsoft';
    this.authorizeUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?';
    this.clientId = config.microsoft.clientId;
    this.callbackUrl = serverUrl + '/hook/authentication/microsoft';
    this.responseType = 'code';
    this.tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    this.clientSecret = config.microsoft.clientSecret;
    this.accessTokenMethod = 'POST';
    this.finalRedirect = config.microsoft.redirect_uri;
    this.accountLinking = config.microsoft.accountLinkng;
    this.grantType = 'authorization_code';
    this.response_mode = 'form_post';
  }
}
