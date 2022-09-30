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
import { isEmpty, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { Token, User } from '../models';
import { AuthUtils } from '../utils/auth';
import { TokenType } from '../constants/TokenType';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { TokenProvider } from './tokenProvider';

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
        message: ConduitString.Required,
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
          phone: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('VerifyPhoneLoginResponse', {
        userId: ConduitString.Optional,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
        message: ConduitString.Optional,
      }),
      this.phoneLogin.bind(this),
    );
  }

  async phoneLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    if (isNil(context) || isEmpty(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    const clientId = context.clientId;
    const { phone, code } = call.request.params;
    const config = ConfigController.getInstance().config;

    const user: User | null = await User.getInstance().findOne({ phoneNumber: phone });
    if (isNil(user)) throw new GrpcError(status.UNAUTHENTICATED, 'User not found');
    const verified = await AuthUtils.verifyCode(
      this.grpcSdk,
      clientId,
      user,
      TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
      code,
    );
    if (!verified) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Code verification unsuccessful');
    }
    return TokenProvider.getInstance(this.grpcSdk)!.provideUserTokens({
      user,
      clientId,
      config,
    });
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const { phone } = call.request.params;
    const context = call.request.context;
    const clientId = context.clientId;
    const config = ConfigController.getInstance().config;
    if (isNil(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    let user: User | null = await User.getInstance().findOne({ phoneNumber: phone });
    if (isNil(user)) {
      user = await User.getInstance().create({
        phoneNumber: phone,
        isVerified: true,
      });
      this.grpcSdk.bus?.publish('authentication:register:user', JSON.stringify(user));

      ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');
      return TokenProvider.getInstance()!.provideUserTokens({
        user,
        clientId,
        config,
      });
    } else {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.sms!,
        user.phoneNumber!,
      );
      if (verificationSid === '') {
        throw new GrpcError(status.INTERNAL, 'Could not send verification code');
      }

      await Token.getInstance()
        .deleteMany({
          user: user._id,
          type: TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });

      await Token.getInstance().create({
        user: user._id,
        type: TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
        token: verificationSid,
      });
      return {
        message: 'Login verification code sent!',
      };
    }
  }
}
