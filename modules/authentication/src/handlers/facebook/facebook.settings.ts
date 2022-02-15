import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';

export class FacebookSettings implements OAuth2Settings {
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
    this.providerName = 'facebook';
    this.accountLinking = config.facebook.accountLinking;
    this.clientId  = config.facebook.clientId;
    this.clientSecret = config.facebook.clientSecret;
    this.finalRedirect = config.facebook.redirect_uri;
    this.callbackUrl = serverUrl + '/hook/authentication/facebook';
    this.responseType = 'code';
    this.authorizeUrl = 'https://www.facebook.com/v11.0/dialog/oauth?';
    this.tokenUrl = 'https://graph.facebook.com/v12.0/oauth/access_token';
    this.accessTokenMethod = 'GET';
  }

}
