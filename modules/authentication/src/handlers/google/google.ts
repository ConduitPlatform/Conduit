import { OAuth2Client } from 'google-auth-library';
import { isNil } from 'lodash';
import ConduitGrpcSdk, { ConduitError, GrpcError } from '@conduitplatform/conduit-grpc-sdk';
import { ConfigController } from '../../config/Config.controller';
import { status } from '@grpc/grpc-js';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { GoogleSettings } from './google.settings';
import { GoogleUser } from './google.user';

export class GoogleHandlers extends OAuth2<GoogleUser, GoogleSettings> {
  private readonly client: OAuth2Client;
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk, settings: GoogleSettings) {
    super(grpcSdk,'google',settings);
    this.client = new OAuth2Client();
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.google.enabled) {
      console.log('Google not active');
      throw ConduitError.forbidden('Google auth is deactivated');
    }
    if (!authConfig.google.clientId) {
      console.log('Google not active');
      throw ConduitError.forbidden('Cannot enable google auth due to missing clientId');
    }
    console.log('Google is active');
    this.initialized = true;
    return true;
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<GoogleUser> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');

    const config = ConfigController.getInstance().config;

    const ticket = await this.client.verifyIdToken({
      idToken: 'id_token',
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (isNil(payload)) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'Received invalid response from the Google API'
      );
    }

    if (!payload.email_verified) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
    }

    let googlePayload: GoogleUser = {
      id: payload.sub,
/*      token: access_token,*/
      email: payload.email,
      data: {},
      // clientId: context.clientId,
    }

    return googlePayload;
  }
}
