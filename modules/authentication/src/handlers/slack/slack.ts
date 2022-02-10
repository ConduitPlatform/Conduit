import { isNil } from 'lodash';
import ConduitGrpcSdk, { ConduitError, GrpcError } from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../../config/Config.controller';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { SlackSettings } from './slack.settings';
import { SlackUser } from './slack.user';

export class SlackHandlers extends OAuth2<SlackUser, SlackSettings> {
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk, settings: SlackSettings) {
    super(grpcSdk, 'slack', settings);
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;

    if (!authConfig.slack.enabled) {
      console.log('Slack not active');
      throw ConduitError.forbidden('Slack auth is deactivated');
    }
    if (!authConfig.slack.clientId) {
      console.log('Slack not active');
      throw ConduitError.forbidden('Cannot enable slack auth due to missing clientId');
    }
    console.log('Slack is active');
    this.initialized = true;
    return true;
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
}
