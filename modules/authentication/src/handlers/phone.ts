import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  SMS,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { Token, User } from '../models';
import { AuthUtils } from '../utils';
import { TokenType } from '../constants/TokenType';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { TokenProvider } from './tokenProvider';
import { v4 as uuid } from 'uuid';

export class PhoneHandlers implements IAuthenticationStrategy {
  private sms: SMS;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    const isAvailable = this.grpcSdk.isAvailable('sms');
    if (config.phoneAuthentication.enabled && isAvailable) {
      this.sms = this.grpcSdk.sms!;
      return (this.initialized = true);
    } else {
      ConduitGrpcSdk.Logger.log('sms phone authentication not active');
      return (this.initialized = false);
    }
  }

  async declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/phone',
        action: ConduitRouteActions.POST,
        description: `Endpoint that can be used to authenticate with phone. 
              A message will be returned which indicates that a verification code has been sent.`,
        bodyParams: {
          phone: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('PhoneAuthenticateResponse', {
        token: ConduitString.Required,
      }),
      this.authenticate.bind(this),
    );
    routingManager.route(
      {
        path: '/phone/verify',
        action: ConduitRouteActions.POST,
        description: `Verifies the token which is used for phone authentication.`,
        bodyParams: {
          code: ConduitString.Required,
          token: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('VerifyPhoneLoginResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.phoneLogin.bind(this),
    );
  }

  async phoneLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { token, code } = call.request.params;
    const config = ConfigController.getInstance().config;
    let user: User | null = null;
    const existingToken: Token | null = await Token.getInstance().findOne({
      token: token,
    });
    if (!existingToken) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid token provided');
    }
    const verified = await AuthUtils.verifyCode(this.grpcSdk, existingToken, code);
    if (!verified) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Code verification unsuccessful');
    }
    if (existingToken.type === TokenType.REGISTER_WITH_PHONE_NUMBER_TOKEN) {
      user = await User.getInstance().create({
        phoneNumber: existingToken.data.phone,
      });
    } else {
      user = await User.getInstance().findOne({ _id: existingToken.user as string });
      if (isNil(user)) throw new GrpcError(status.UNAUTHENTICATED, 'User not found');
    }

    return TokenProvider.getInstance(this.grpcSdk)!.provideUserTokens({
      user,
      clientId: existingToken.data.clientId,
      config,
    });
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const { phone } = call.request.params;
    const { clientId } = call.request.context;
    const user: User | null = await User.getInstance().findOne({ phoneNumber: phone });
    const existingToken = await Token.getInstance().findOne({
      type: {
        $in: [
          TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
          TokenType.REGISTER_WITH_PHONE_NUMBER_TOKEN,
        ],
      },
      data: {
        phone,
      },
    });
    if (existingToken) {
      AuthUtils.checkResendThreshold(existingToken);
      await Token.getInstance().deleteMany({
        type: {
          $in: [
            TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
            TokenType.REGISTER_WITH_PHONE_NUMBER_TOKEN,
          ],
        },
        data: {
          phone,
        },
      });
    }

    const verificationSid = await AuthUtils.sendVerificationCode(this.sms!, phone);
    if (verificationSid === '') {
      throw new GrpcError(status.INTERNAL, 'Could not send verification code');
    }
    const token = await Token.getInstance().create({
      type: isNil(user)
        ? TokenType.REGISTER_WITH_PHONE_NUMBER_TOKEN
        : TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
      user: user,
      data: {
        clientId,
        phone,
        verification: verificationSid,
      },
      token: uuid(),
    });
    return {
      token: token.token,
    };
  }
}
