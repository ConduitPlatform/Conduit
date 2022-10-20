import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { BitbucketUser } from './bitbucket.user';
import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import * as bitbucketParameters from './bitbucket.json';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { Payload } from '../interfaces/Payload';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { isNil } from 'lodash';
import { AuthParams } from '../interfaces/AuthParams';

export class BitbucketHandlers extends OAuth2<BitbucketUser, OAuth2Settings> {
  constructor(
    grpcSdk: ConduitGrpcSdk,
    config: { bitbucket: ProviderConfig },
    serverConfig: { hostUrl: string },
  ) {
    super(
      grpcSdk,
      'bitbucket',
      new OAuth2Settings(serverConfig.hostUrl, config.bitbucket, bitbucketParameters),
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
    const requestData: string = Object.keys(data)
      .map(k => {
        return k + '=' + data[k as keyof AuthParams];
      })
      .join('&');

    return {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      data: requestData,
      headers: {
        Accept: 'application/json',
      },
    };
  }
}
