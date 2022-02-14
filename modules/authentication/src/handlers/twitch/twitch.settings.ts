import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';

export class TwitchSettings implements OAuth2Settings {
  accessTokenMethod: string;
  accountLinking: boolean;
  authorizeUrl: string;
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  finalRedirect: string;
  providerName: string;
  tokenUrl: string;
  grantType: string;
  responseType: string;

  constructor(grpcSdk: ConduitGrpcSdk, config: any, serverUrl: string) {
    this.authorizeUrl= 'https://id.twitch.tv/oauth2/authorize?';
    this.clientId= config.twitch.clientId;
    this.callbackUrl= serverUrl + '/hook/authentication/twitch';
    this.responseType= 'code';
    this.grantType= 'authorization_code';
    this.clientSecret= config.twitch.clientSecret;
    this.tokenUrl= 'https://id.twitch.tv/oauth2/token';
    this.accessTokenMethod= 'POST';
    this.finalRedirect= config.twitch.redirect_uri;
    this.accountLinking= config.twitch.accountLinking;
  };
}
