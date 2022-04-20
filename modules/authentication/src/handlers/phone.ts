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

export class PhoneHandlers {
  private sms: SMS;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk, private readonly routingManager: RoutingManager) {

  }

  async validate(): Promise<Boolean> {
    const config = ConfigController.getInstance().config;
    let errorMessage = null;
    await this.grpcSdk.config
      .moduleExists('sms')
      .catch((e: any) => (errorMessage = e.message));
    if (config.phoneAuthentication.enabled && !errorMessage) {
      // maybe check if verify is enabled in sms module
      await this.grpcSdk.waitForExistence('sms');
      this.sms = this.grpcSdk.sms!;
      this.initialized = true;
      return true;
    } else {
      console.log('sms phone authentication not active');
      return false;
    }
  }

  async declareRoutes() {
    this.routingManager.route(
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
    this.routingManager.route(
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
    return await AuthUtils.verifyCode(this.grpcSdk, clientId, user, TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN, code);
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const { phone } = call.request.params;
    const context = call.request.context;
    const clientId = context.clientId;
    const config = ConfigController.getInstance().config;
    if (isNil(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    let user: User | null = await User.getInstance().findOne(
      { phoneNumber: phone },
    );
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

      const refreshToken: RefreshToken = await RefreshToken.getInstance().create({
        userId: user._id,
        clientId,
        token: AuthUtils.randomToken(),
        expiresOn: moment()
          .add(config.refreshTokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      });
      if (config.set_cookies.enabled) {
        return AuthUtils.returnCookies((accessToken as any).token, (refreshToken as any).token);
      }

      return {
        userId: user._id.toString(),
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
      };

    } else {
      const verificationSid = await AuthUtils.sendVerificationCode(this.sms!, user.phoneNumber!);
      if (verificationSid === '') {
        throw new GrpcError(status.INTERNAL, 'Could not send verification code');
      }

      await Token.getInstance()
        .deleteMany({
          userId: user._id,
          type: TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
        })
        .catch(console.error);

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