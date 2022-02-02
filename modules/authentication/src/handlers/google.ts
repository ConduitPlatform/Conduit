import { OAuth2Client } from 'google-auth-library';
import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../config/Config.controller';
import { User } from '../models';
import { AuthenticationProviderClass } from './models/AuthenticationProviderClass';
import { Payload } from './interfaces/Payload';
import { FacebookPayload } from './interfaces/facebook/FacebookPayload';
import { ConnectionCredentials } from './interfaces/ConnectionCredentials';

export class GoogleHandlers extends AuthenticationProviderClass<Payload> {
  private readonly client: OAuth2Client;
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk) {
    super(grpcSdk,'google');
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

  async connectWithProvider(options: ConnectionCredentials): Promise<any> {
    // if (!this.initialized)
    //   throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    //
    // const ticket = await this.client.verifyIdToken({
    //   idToken: id_token,
    //   audience: config.google.clientId,
    // });
    //
    // const payload = ticket.getPayload();
    // if (isNil(payload)) {
    //   throw new GrpcError(
    //     status.UNAUTHENTICATED,
    //     'Received invalid response from the Google API'
    //   );
    // }
    // if (!payload.email_verified) {
    //   throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
    // }
    return 5 as any;

  }
}
