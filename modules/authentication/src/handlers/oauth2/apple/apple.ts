import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import ConduitGrpcSdk, {
  ConduitJson,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import * as appleParameters from '../apple/apple.json';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { Payload } from '../interfaces/Payload';
import axios from 'axios';
import { AppleUser } from './apple.user';
import * as jwt from 'jsonwebtoken';
import { TokenProvider } from '../../tokenProvider';
import { Token } from '../../../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import moment from 'moment';

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
    this.defaultScopes = ['name', 'email', 'openid'];
  }

  async validate(): Promise<boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig['apple'].enabled) {
      ConduitGrpcSdk.Logger.log(`Apple authentication not available`);
      return (this.initialized = false);
    }
    if (
      !authConfig['apple'] ||
      !authConfig['apple'].clientId ||
      !authConfig['apple'].privateKey ||
      !authConfig['apple'].teamId
    ) {
      ConduitGrpcSdk.Logger.log(`Apple authentication not available`);
      return (this.initialized = false);
    }
    ConduitGrpcSdk.Logger.log(`Apple authentication is available`);
    return (this.initialized = true);
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<AppleUser>> {
    // request an authorization to the Sign in with Apple server
    const authorization = await axios.get('https://appleid.apple.com/auth/authorize?', {
      params: {
        response_type: this.settings.responseType,
        redirect_uri: this.settings.authorizeUrl,
        client_id: this.settings.clientId,
      },
    });

    const decoded = jwt.decode(authorization.data.id_token, { complete: true });

    return {
      id: decoded!.payload.sub as string,
      email: authorization.data.user.email,
      data: { ...authorization.data },
    };
  }

  constructScopes(scopes: string[]): string {
    return scopes.join('%20');
  }

  async authorize(call: ParsedRouterRequest) {
    const params = call.request.params;
    const stateToken: Token | null = await Token.getInstance().findOne({
      token: params.state,
    });
    if (isNil(stateToken))
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid parameters');
    if (moment().isAfter(moment(stateToken.data.expiresAt))) {
      await Token.getInstance().deleteOne(stateToken);
      throw new GrpcError(status.INVALID_ARGUMENT, 'Token expired');
    }

    const apple_private_key = this.settings.privateKey;

    const apple_client_secret = jwt.sign(
      {
        iss: this.settings.teamId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        aud: 'https://appleid.apple.com',
        sub: this.settings.clientId,
      },
      apple_private_key!,
      {
        algorithm: 'ES256',
        expiresIn: '180d',
        issuer: this.settings.teamId,
        header: {
          alg: 'ES256',
          kid: this.settings.keyId,
        },
      },
    );

    const clientId = stateToken.data.clientId;
    // use /token request to apple to verify received code and id_token
    const token = await axios.post('https://appleid.apple.com/auth/token', {
      client_id: clientId,
      client_secret: apple_client_secret,
      code: params.code,
      grant_type: this.settings.grantType,
      redirect_uri: this.settings.tokenUrl,
    });

    const userParams = params.user;
    const decoded_token_id_token = jwt.decode(token.data.id_token, { complete: true });
    const decoded_id_token = jwt.decode(params.id_token, { complete: true });
    if (decoded_token_id_token?.header.kid !== decoded_id_token?.header.kid) {
      throw new Error('Invalid token');
    }
    await Token.getInstance().deleteOne(stateToken);
    const user = await this.createOrUpdateUser(userParams);
    const config = ConfigController.getInstance().config;
    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');

    return TokenProvider.getInstance()!.provideUserTokens(
      {
        user,
        clientId,
        config,
      },
      this.settings.finalRedirect,
    );
  }

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: `/init/apple`,
        description: `Begins Apple authentication.`,
        action: ConduitRouteActions.GET,
      },
      new ConduitRouteReturnDefinition(`AppleInitResponse`, 'String'),
      this.redirect.bind(this),
    );

    routingManager.route(
      {
        path: `/hook/apple`,
        action: ConduitRouteActions.POST,
        description: `Login/register with Apple using redirect.`,
        bodyParams: {
          authorization: {
            code: ConduitString.Required,
            id_token: ConduitString.Required,
            state: ConduitString.Required,
          },
          user: ConduitJson.Required,
        },
      },
      new ConduitRouteReturnDefinition(`AppleResponse`, {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authorize.bind(this),
    );
  }
}
