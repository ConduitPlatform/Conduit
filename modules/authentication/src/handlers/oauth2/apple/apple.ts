import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import * as appleParameters from '../apple/apple.json';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { Payload } from '../interfaces/Payload';
import axios from 'axios';
import { AppleUser } from './apple.user';
import jwksRsa from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';

export class AppleHandlers extends OAuth2<AppleUser, OAuth2Settings> {
  constructor(
    grpcSdk: ConduitGrpcSdk,
    config: { apple: ProviderConfig },
    serverConfig: { hostUrl: string },
  ) {
    super(
      grpcSdk,
      'apple',
      new OAuth2Settings(serverConfig.hostUrl, config.apple, appleParameters),
    );
    this.defaultScopes = ['.name', '.email'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<AppleUser>> {
    const apple_access_token = details.accessToken;
    const apple_keys = await axios.get('https://appleid.apple.com/auth/keys');

    const apple_public_kid = apple_keys.data.keys[0].kid;

    const apple_public_key = await this.generateApplePublicKey(apple_public_kid);
    const apple_private_key = details.privateKey;

    const apple_client_secret = jwt.sign({}, apple_private_key!, {
      algorithm: 'ES256',
      expiresIn: '180d',
      issuer: details.teamId,
      header: {
        alg: 'ES256',
        kid: apple_public_kid,
      },
    });

    const appleProfile = await axios.post('https://appleid.apple.com/auth/token', {
      client_id: details.clientId,
      client_secret: apple_client_secret,
      code: apple_access_token,
      grant_type: 'authorization_code',
      redirect_uri: '',
    });

    return {
      id: appleProfile.data.sub,
      email: appleProfile.data.email,
      data: { ...appleProfile.data },
    };
  }

  private async generateApplePublicKey(apple_public_key_id: string) {
    const client = jwksRsa({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
    });

    const key = await client.getSigningKey(apple_public_key_id);
    const publicKey = key.getPublicKey();
    return publicKey;
  }
}
