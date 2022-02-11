import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { GoogleSettings } from './google.settings';
import { GoogleUser } from './google.user';
import axios from 'axios';

export class GoogleHandlers extends OAuth2<GoogleUser, GoogleSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, settings: GoogleSettings) {
    super(grpcSdk, 'google', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<GoogleUser> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');

    const googleUser = await axios
      .get(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${details.accessToken}&token_type=Bearer`,
      )
      .then((res) => res.data)
      .catch((error) => {
        console.error(`Failed to fetch user`);
        throw new Error(error.message);
      });

    let googlePayload: GoogleUser = {
      id: googleUser.id,
      email: googleUser.email,
      data: {
        name: googleUser.name,
        given_name: googleUser.givenName,
        locale: googleUser.locale,
        verified_email: googleUser.verified_email,
        picture: googleUser.picture,
        family_name: googleUser.familyName,
      },
    };
    return googlePayload;
  }

  async makeRequest(data: any) {
    return  {
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
