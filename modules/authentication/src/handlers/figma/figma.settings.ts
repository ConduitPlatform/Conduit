import { OAuth2Settings } from '../../handlers/AuthenticationProviders/interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class FigmaSettings implements OAuth2Settings {
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
  grantType: string;

  constructor(grpcSdk: ConduitGrpcSdk, config: any, serverUrl: string) {
    this.providerName = 'figma';
    this.authorizeUrl = 'https://www.figma.com/oauth?';
    this.clientId = config.figma.clientId;
    this.callbackUrl = serverUrl + '/hook/authentication/figma';
    this.responseType = 'code';
    this.tokenUrl = 'https://www.figma.com/api/oauth/token';
    this.clientSecret = config.figma.clientSecret;
    this.accessTokenMethod = 'POST';
    this.finalRedirect = config.figma.redirect_uri;
    this.accountLinking = config.figma.accountLinking;
    this.grantType = 'authorization_code';

  }
}
