import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import ConduitGrpcSdk, {
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
import jwksRsa from 'jwks-rsa';
import { Jwt, JwtHeader, JwtPayload } from 'jsonwebtoken';

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

  // @ts-ignore
  // we don't implement this method for apple provider
  async connectWithProvider(details: ConnectionParams): Promise<Payload<AppleUser>> {}

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
    const decoded_id_token = jwt.decode(params.id_token, { complete: true });

    const publicKeys = await axios.get('https://appleid.apple.com/auth/keys');
    const publicKey = publicKeys.data.keys.find(
      (key: any) => key.kid === decoded_id_token!.header.kid,
    );
    const applePublicKey = await this.generateApplePublicKey(publicKey.kid);
    this.verifyIdentityToken(applePublicKey, params.id_token);

    const apple_private_key = this.settings.privateKey;

    const apple_client_secret = jwt.sign(
      {
        iss: this.settings.teamId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 120,
        aud: 'https://appleid.apple.com',
        sub: this.settings.clientId,
      },
      apple_private_key as any,
      {
        header: {
          alg: 'ES256',
          kid: this.settings.keyId,
        },
      },
    );

    const clientId = stateToken.data.clientId;
    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;
    const token = await axios
      .post(
        'https://appleid.apple.com/auth/token',
        {
          client_id: this.settings.clientId,
          client_secret: apple_client_secret,
          code: params.code,
          grant_type: this.settings.grantType,
          redirect_uri: `${conduitUrl}/hook/authentication/${this.settings.providerName}`,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )
      .then(response => {
        return response.data;
      })
      .catch(error => {
        throw new GrpcError(status.INVALID_ARGUMENT, error.message);
      });

    const userParams = {
      id: decoded_id_token!.payload.sub as string,
      email: params?.user.email,
      data: { ...params?.user.name },
    };
    const user = await this.createOrUpdateUser(userParams);
    await Token.getInstance().deleteOne(stateToken);
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
          code: ConduitString.Required,
          id_token: ConduitString.Required,
          state: ConduitString.Required,
          user: {
            name: {
              firstName: ConduitString.Required,
              lastName: ConduitString.Required,
            },
            email: ConduitString.Required,
          },
        },
      },
      new ConduitRouteReturnDefinition(`AppleResponse`, {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authorize.bind(this),
    );
  }

  private async generateApplePublicKey(apple_public_key_id: string) {
    const client = jwksRsa({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
    });
    const key = await client.getSigningKey(apple_public_key_id);
    return key.getPublicKey();
  }

  private verifyIdentityToken(applePublicKey: string, id_token: string) {
    const decoded = jwt.decode(id_token, { complete: true }) as Jwt;
    const payload = decoded.payload as JwtPayload;
    const header = decoded.header as JwtHeader;
    const verified = jwt.verify(id_token, applePublicKey, {
      algorithms: [header.alg as jwt.Algorithm],
    });
    if (!verified) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid token');
    }

    if (payload.iss !== 'https://appleid.apple.com') {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid iss');
    }
    if (payload.aud !== this.settings.clientId) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid aud');
    }

    if (payload.exp! < moment().unix()) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Token expired');
    }
  }
}
