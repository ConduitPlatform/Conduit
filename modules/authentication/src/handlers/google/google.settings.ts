import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class GoogleSettings implements OAuth2Settings {
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

  constructor(private readonly grpcSdk: ConduitGrpcSdk, config: any, serverUrl: string) {
    this.providerName = 'google';
    this.accountLinking = config.google.accountLinking;
    this.clientId  = config.google.clientId;
    this.clientSecret = config.google.clientSecret;
    this.finalRedirect = config.google.redirect_uri;
    this.callbackUrl = serverUrl + '/hook/authentication/google';
    this.responseType = 'code';
    this.authorizeUrl = 'https://accounts.google.com/o/oauth2/v2/auth?';
    this.tokenUrl = 'https://oauth2.googleapis.com/token';
    this.accessTokenMethod = 'POST';
  }
}
