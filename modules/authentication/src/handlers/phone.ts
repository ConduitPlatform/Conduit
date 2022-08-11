import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  SMS,
  UnparsedRouterResponse,
  ConfigController,
} from '@conduitplatform/grpc-sdk';
import { isEmpty, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { AccessToken, RefreshToken, Token, User } from '../models';
import { AuthUtils } from '../utils/auth';
import { TokenType } from '../constants/TokenType';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';
import moment = require('moment');
import { Cookie } from '../interfaces/Cookie';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';

export class PhoneHandlers implements IAuthenticationStrategy {
  private sms: SMS;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    let errorMessage = null;
    await this.grpcSdk.config.moduleExists('sms').catch(e => (errorMessage = e.message));
    if (config.phoneAuthentication.enabled && !errorMessage) {
      // maybe check if verify is enabled in sms module
      await this.grpcSdk.waitForExistence('sms');
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
        description: `Verifies the token which is used for phone authentication`,
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
    const user: User | null = await User.getInstance().findOne({ phoneNumber: phone });
    if (isNil(user)) throw new GrpcError(status.UNAUTHENTICATED, 'User not found');
    return await AuthUtils.verifyCode(
      this.grpcSdk,
      clientId,
      user,
      TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
      code,
    );
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

      await Promise.all(
        AuthUtils.deleteUserTokens(this.grpcSdk, {
          userId: user._id,
          clientId,
        }),
      );

      const signTokenOptions: ISignTokenOptions = {
        secret: config.jwtSecret,
        expiresIn: config.tokenInvalidationPeriod,
      };

      const accessToken: AccessToken = await AccessToken.getInstance().create({
        userId: user._id,
        clientId,
        token: AuthUtils.signToken({ id: user._id }, signTokenOptions),
        expiresOn: moment()
          .add(config.tokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      });
      let refreshToken = null;
      if (config.generateRefreshToken) {
        refreshToken = await RefreshToken.getInstance().create({
          userId: user._id,
          clientId,
          token: AuthUtils.randomToken(),
          expiresOn: moment()
            .add(config.refreshTokenInvalidationPeriod as number, 'milliseconds')
            .toDate(),
        });
      }
      ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');
      if (config.setCookies.enabled) {
        const cookieOptions = config.setCookies.options;
        const cookies: Cookie[] = [
          {
            name: 'accessToken',
            value: (accessToken as AccessToken).token,
            options: cookieOptions,
          },
        ];
        if (!isNil((refreshToken as RefreshToken).token)) {
          cookies.push({
            name: 'refreshToken',
            value: (refreshToken! as RefreshToken).token,
            options: cookieOptions,
          });
        }
        return {
          result: { message: 'Successfully authenticated' },
          setCookies: cookies,
        };
      }
      return {
        userId: user._id.toString(),
        accessToken: accessToken.token,
        refreshToken: !isNil(refreshToken)
          ? (refreshToken as RefreshToken).token
          : undefined,
      };
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
          userId: user._id,
          type: TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });

      const verificationToken = await Token.getInstance().create({
        userId: user._id,
        type: TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
        token: verificationSid,
      });
      return {
        message: 'Login verification code sent!',
      };
    }
  }
}
