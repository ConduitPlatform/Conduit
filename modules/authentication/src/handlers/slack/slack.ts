import { isNil } from 'lodash';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { SlackSettings } from './slack.settings';
import { SlackUser } from './slack.user';

export class SlackHandlers extends OAuth2<SlackUser, SlackSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, settings: SlackSettings) {
    super(grpcSdk, 'slack', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<SlackUser> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const slackOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://slack.com/api/users.profile.get',
      headers: {
        'Authorization': 'Bearer ' + details.accessToken,
      },
    };

    const slackResponse: any = await axios(slackOptions);
    if (isNil(slackResponse.data.profile.email) || isNil(slackResponse.data.profile.avatar_hash)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with slack failed');
    }


    let payload: SlackUser = {
      id: slackResponse.data.profile.avatar_hash,
      email: slackResponse.data.profile.email,
      data: {},
    };
    return payload;
  }

  async makeRequest(data: any) {
    return {
      method: this.settings.accessTokenMethod as any,
      url: this.settings.tokenUrl,
      params: { ...data },
      headers: {
        'Accept': 'application/json',
      },
      data: null,
    };
  }
}
