import { isNil } from 'lodash-es';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';
import axios from 'axios';
import { OAuth2 } from '../OAuth2.js';
import { SlackUser } from './slack.user.js';
import slackParameters from './slack.json' with { type: 'json' };
import {
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';
import { SlackResponse } from './slack.response.js';

export class SlackHandlers extends OAuth2<SlackUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { slack: ProviderConfig }) {
    super(grpcSdk, 'slack', new OAuth2Settings(config.slack, slackParameters));
    this.defaultScopes = ['users:read'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<SlackUser>> {
    if (!this.initialized) throw new ModuleError(errors.STRATEGY_DISABLED);
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
      throw new ModuleError({
        ...errors.OAUTH_PROVIDER_AUTH_FAILED,
        message: 'Authentication with slack failed',
      });
    }

    return {
      id: slackResponse.data.profile.avatar_hash,
      email: slackResponse.data.profile.email,
      data: { ...slackResponse.data.profile },
    };
  }
}
