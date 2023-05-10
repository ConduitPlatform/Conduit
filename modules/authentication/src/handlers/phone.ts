import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  SMS,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';

import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { Token, User } from '../models';
import { AuthUtils } from '../utils';
import { TokenType } from '../constants/TokenType';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { TokenProvider } from './tokenProvider';
import { v4 as uuid } from 'uuid';
import { TeamsHandler } from './team';

export class PhoneHandlers implements IAuthenticationStrategy {
  private sms: SMS;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    const isAvailable = this.grpcSdk.isAvailable('sms');
    if (config.phoneAuthentication.enabled && isAvailable) {
      this.sms = this.grpcSdk.sms!;
      ConduitGrpcSdk.Logger.log('Phone authentication is available');
      return (this.initialized = true);
    } else {
      ConduitGrpcSdk.Logger.log('Phone authentication not available');
      return (this.initialized = false);
    }
  }

  async declareRoutes(routingManager: RoutingManager) {
    const captchaConfig = ConfigController.getInstance().config.captcha;
    routingManager.route(
      {
        path: '/phone',
        action: ConduitRouteActions.POST,
        description: `Endpoint that can be used to authenticate with phone. 
              A message will be returned which indicates that a verification code has been sent.`,
        bodyParams: {
          phone: ConduitString.Required,
          captchaToken: ConduitString.Optional,
          invitationToken: ConduitString.Optional,
        },
        middlewares:
          captchaConfig.enabled && captchaConfig.routes.login
            ? ['captchaMiddleware']
            : undefined,
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
    if (existingToken.tokenType === TokenType.REGISTER_WITH_PHONE_NUMBER_TOKEN) {
      user = await User.getInstance().create({
        phoneNumber: existingToken.data.phone,
      });
      if (isNil(existingToken.data.invitationToken)) {
        await TeamsHandler.getInstance()
          .addUserToDefault(user)
          .catch(err => {
            ConduitGrpcSdk.Logger.error(err);
          });
      } else {
        await TeamsHandler.getInstance()
          .addUserToTeam(user, existingToken.data.invitationToken)
          .catch(err => {
            ConduitGrpcSdk.Logger.error(err);
          });
      }
    } else {
      user = await User.getInstance().findOne({ _id: existingToken.user as string });
      if (isNil(user)) throw new GrpcError(status.UNAUTHENTICATED, 'User not found');
    }

    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId: existingToken.data.clientId,
      config,
    });
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const { phone, invitationToken } = call.request.params;
    const { clientId } = call.request.context;
    const user: User | null = await User.getInstance().findOne({ phoneNumber: phone });
    if (!user) {
      const teams = ConfigController.getInstance().config.teams;
      if (
        teams.enabled &&
        !teams.allowRegistrationWithoutInvite &&
        isNil(invitationToken)
      ) {
        throw new GrpcError(status.PERMISSION_DENIED, 'Registration requires invitation');
      }
    }
    const existingToken = await Token.getInstance().findOne({
      tokenType: {
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
        tokenType: {
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
      tokenType: isNil(user)
        ? TokenType.REGISTER_WITH_PHONE_NUMBER_TOKEN
        : TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
      user: user,
      data: {
        clientId,
        phone,
        verification: verificationSid,
        invitationToken,
      },
      token: uuid(),
    });
    return {
      token: token.token,
    };
  }
}
