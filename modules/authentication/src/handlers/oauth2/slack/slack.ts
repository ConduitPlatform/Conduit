import { isNil } from 'lodash';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios from 'axios';
import { OAuth2 } from '../OAuth2';
import { SlackUser } from './slack.user';
import * as slackParameters from './slack.json';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import { SlackResponse } from './slack.response';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { Payload } from '../interfaces/Payload';
import { ConnectionParams } from '../interfaces/ConnectionParams';

export class SlackHandlers extends OAuth2<SlackUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { slack: ProviderConfig }) {
    super(grpcSdk, 'slack', new OAuth2Settings(config.slack, slackParameters));
    this.defaultScopes = ['users:read'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<SlackUser>> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const slackResponse: SlackResponse = await axios.get(
      'https://slack.com/api/users.profile.get',
      {
        headers: {
          Authorization: 'Bearer ' + details.accessToken,
        },
      },
    );
    if (
      isNil(slackResponse.data.profile.email) ||
      isNil(slackResponse.data.profile.avatar_hash)
    ) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with slack failed');
    }

    return {
      id: slackResponse.data.profile.avatar_hash,
      email: slackResponse.data.profile.email,
      data: { ...slackResponse.data.profile },
    };
  }
}
