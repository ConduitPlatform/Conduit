import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';

export class SlackSettings implements OAuth2Settings {
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
    this.providerName = 'slack';
    this.authorizeUrl = 'https://slack.com/oauth/authorize?';
    this.clientId = config.slack.clientId;
    this.callbackUrl = serverUrl + '/hook/authentication/slack';
    this.responseType = 'code';
    this.tokenUrl = 'https://slack.com/api/oauth.access';
    this.clientSecret = config.slack.clientSecret;
    this.accessTokenMethod = 'POST';
    this.finalRedirect = config.slack.redirect_uri;
    this.accountLinking = config.slack.accountLinking;
  }

}