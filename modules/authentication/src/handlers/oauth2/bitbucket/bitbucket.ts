import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { BitbucketUser } from './bitbucket.user.js';
import { OAuth2 } from '../OAuth2.js';
import {
  AuthParams,
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';
import bitbucketParameters from './bitbucket.json' with { type: 'json' };
import { isNil } from 'lodash-es';
import { makeRequest } from '../utils/index.js';

export class BitbucketHandlers extends OAuth2<BitbucketUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { bitbucket: ProviderConfig }) {
    super(
      grpcSdk,
      'bitbucket',
      new OAuth2Settings(config.bitbucket, bitbucketParameters),
    );
    this.defaultScopes = ['account'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<BitbucketUser>> {
    const bitbucket_access_token = details.accessToken;
    const bitbucketProfile = await axios.get('https://api.bitbucket.org/2.0/user', {
      headers: {
        Authorization: `Bearer ${bitbucket_access_token}`,
        Accept: 'application/json',
      },
    });

    let email;
    if (isNil(bitbucketProfile.data.email)) {
      const bitbucketUserEmail = await axios.get(
        'https://api.bitbucket.org/2.0/user/emails',
        {
          headers: {
            Authorization: `Bearer ${bitbucket_access_token}`,
            Accept: 'application/json',
          },
        },
      );
      email = bitbucketUserEmail.data.values[0].email;
    } else {
      email = bitbucketProfile.data.email;
    }
    return {
      id: bitbucketProfile.data.uuid,
      email: email,
      data: { ...bitbucketProfile.data },
    };
  }

  makeRequest(data: AuthParams) {
    return makeRequest(data, this.settings);
  }
}
