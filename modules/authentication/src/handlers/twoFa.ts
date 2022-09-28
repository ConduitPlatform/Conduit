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
import { Token, TwoFactorSecret, User } from '../models';
import { AuthUtils } from '../utils/auth';
import { TokenType } from '../constants/TokenType';
import * as node2fa from '@conduitplatform/node-2fa';
import { v4 as uuid } from 'uuid';
import { TokenProvider } from './tokenProvider';
import { Config } from '../config';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';

export class TwoFa implements IAuthenticationStrategy {
  private smsModule: SMS;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const authConfig: Config = ConfigController.getInstance().config;
    if (!authConfig.twoFa.enabled) {
      ConduitGrpcSdk.Logger.error('TwoFa is not enabled');
      return false;
    }
    if (authConfig.twoFa.enabled && authConfig.twoFa.methods.sms) {
      if (!this.grpcSdk.isAvailable('sms')) {
        ConduitGrpcSdk.Logger.error('SMS module not found');
        return false;
      }
    }
    ConduitGrpcSdk.Logger.log('Service is active');
    return true;
  }

  declareRoutes(routingManager: RoutingManager, config: Config): void {
    routingManager.route(
      {
        path: '/twoFa/verify',
        action: ConduitRouteActions.POST,
        description: `Verifies the code the user received from their authentication method.
        This is used after the user provides credentials to the login endpoint.`,
        middlewares: ['authMiddleware'],
        bodyParams: {
          code: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('VerifyTwoFaResponse', {
        userId: ConduitString.Optional,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
        message: ConduitString.Optional,
      }),
      this.verify2FA.bind(this),
    );

    routingManager.route(
      {
        path: '/twoFa/enable/verify',
        action: ConduitRouteActions.POST,
        description: `Verifies the code the user received from their authentication method`,
        middlewares: ['authMiddleware'],
        bodyParams: {
          code: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('VerifyAuthenticatorResponse', 'String'),
      this.verifyCode.bind(this),
    );
    routingManager.route(
      {
        path: '/twoFa/enable',
        action: ConduitRouteActions.UPDATE,
        description: `Enables a phone or qr based 2FA method for a user and 
                requires their phone number in case of phone 2FA.`,
        middlewares: ['authMiddleware'],
        bodyParams: {
          method: ConduitString.Required,
          phoneNumber: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('EnableTwoFaResponse', 'String'),
      this.enableTwoFa.bind(this),
    );

    routingManager.route(
      {
        path: '/twoFa/disable',
        action: ConduitRouteActions.UPDATE,
        description: `Disables the user's 2FA mechanism.`,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('DisableTwoFaResponse', 'String'),
      this.disableTwoFa.bind(this),
    );
  }

  async enableTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { method, phoneNumber } = call.request.params;
    const context = call.request.context;
    const user = context.user;
    if (user.hasTwoFA) {
      return '2FA already enabled';
    }
    if (method === 'sms' && ConfigController.getInstance().config.twoFa.methods.sms) {
      return this.enableSms2Fa(user, phoneNumber!);
    } else if (
      method === 'authenticator' &&
      ConfigController.getInstance().config.twoFa.methods.authenticator
    ) {
      return this.enableAuthenticator2Fa(user);
    } else {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Method not valid');
    }
  }

  async verify2FA(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const clientId = context.clientId;
    const { code } = call.request.params;
    return this.verifyAuthentication(context.user, code, clientId);
  }

  verifyCode(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const { code } = call.request.params;
    const user: User = context.user;
    if (user.twoFaMethod === 'authenticator') {
      return this.verifyAuthenticatorCode(user, code);
    } else {
      return this.verifyPhoneNumber(user, code);
    }
  }

  async disableTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    if (isNil(context) || isNil(context.user)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
    }
    return this.disable2Fa(context.user);
  }

  private async enableSms2Fa(user: User, phoneNumber: string): Promise<string> {
    const verificationSid = await AuthUtils.sendVerificationCode(
      this.smsModule,
      phoneNumber,
    );
    if (verificationSid === '') {
      throw new GrpcError(status.INTERNAL, 'Could not send verification code');
    }
    await AuthUtils.createToken(
      user._id,
      { data: phoneNumber },
      TokenType.VERIFY_PHONE_NUMBER_TOKEN,
    ).catch(e => ConduitGrpcSdk.Logger.error(e));

    await User.getInstance().findByIdAndUpdate(user._id, {
      twoFaMethod: 'phone',
    });
    return 'Verification code sent';
  }

  private async enableAuthenticator2Fa(user: User): Promise<string> {
    const secret = node2fa.generateSecret({
      //to do: add logic for app name insertion
      name: 'Conduit',
      // add another string when mail is not available
      account: user.email ?? `conduit-${user._id}`,
    });
    await TwoFactorSecret.getInstance().deleteMany({
      user: user._id,
    });
    await TwoFactorSecret.getInstance().create({
      user: user._id,
      secret: secret.secret,
      uri: secret.uri,
      qr: secret.qr,
    });
    await User.getInstance().findByIdAndUpdate(user._id, {
      twoFaMethod: 'authenticator',
    });
    return secret.qr.toString();
  }

  async disable2Fa(user: User): Promise<string> {
    await User.getInstance().findByIdAndUpdate(user._id, {
      hasTwoFA: false,
    });
    this.grpcSdk.bus?.publish(
      'authentication:disableTwofa:user',
      JSON.stringify({ id: user._id }),
    );
    return '2FA disabled';
  }

  async authenticate(
    user: User,
  ): Promise<
    | { message: string; accessToken?: undefined }
    | { message: string; accessToken: string }
  > {
    if (user.twoFaMethod === 'phone') {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.smsModule,
        user.phoneNumber!,
      );
      if (verificationSid === '') {
        throw new GrpcError(status.INTERNAL, 'Could not send verification code');
      }
      await Token.getInstance()
        .deleteMany({
          user: user._id,
          type: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      await Token.getInstance().create({
        user: user._id,
        type: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
        token: verificationSid,
      });
      return {
        message: 'Verification code sent',
      };
    } else if (user.twoFaMethod === 'authenticator') {
      const secret = await TwoFactorSecret.getInstance().findOne({
        user: user._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Authentication unsuccessful');
      await Token.getInstance()
        .deleteMany({
          user: user._id,
          type: TokenType.AUTHENTICATOR_VERIFICATION_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      const qrVerificationToken = await Token.getInstance().create({
        user: user._id,
        type: TokenType.AUTHENTICATOR_VERIFICATION_TOKEN,
        token: uuid(),
      });
      return {
        message: 'OTP required',
        accessToken: qrVerificationToken.token,
      };
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Method not valid');
    }
  }

  async verifyAuthentication(
    user: User,
    code: string,
    clientId: string,
  ): Promise<{ userId?: string; accessToken?: string; refreshToken?: string }> {
    if (user.twoFaMethod === 'phone') {
      return await AuthUtils.verifyCode(
        this.grpcSdk,
        clientId,
        user,
        TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
        code,
      );
    } else if (user.twoFaMethod == 'authenticator') {
      return await this.verifyAuthenticatorCodeForLogin(clientId, user, code);
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Method not valid');
    }
  }

  async changePassword(user: User, newPassword: string): Promise<string> {
    await Token.getInstance()
      .deleteMany({
        user: user._id,
        type: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    if (user.twoFaMethod === 'phone') {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.smsModule,
        user.phoneNumber!,
      );
      if (verificationSid === '') {
        throw new GrpcError(status.INTERNAL, 'Could not send verification code');
      }
      await Token.getInstance().create({
        user: user._id,
        type: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
        token: verificationSid,
        data: {
          password: newPassword,
        },
      });
      return 'Verification code sent';
    } else if (user.twoFaMethod == 'authenticator') {
      const secret = await TwoFactorSecret.getInstance().findOne({
        user: user._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Authentication unsuccessful');

      await Token.getInstance().create({
        user: user._id,
        type: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
        token: uuid(),
        data: {
          password: newPassword,
        },
      });
      return 'OTP required';
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, '2FA method not specified');
    }
  }

  async check2FaCode(user: User, code: string, token: Token) {
    if (user.twoFaMethod === 'phone') {
      const verification = await this.smsModule.verify(token!.token, code);
      if (!verification.verified) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Provided code is invalid');
      }
    } else if (user.twoFaMethod === 'authenticator') {
      const secret = await TwoFactorSecret.getInstance().findOne({
        user: user._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');
      const verification = node2fa.verifyToken(secret.secret, code, 1);
      if (isNil(verification) || verification.delta !== 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Provided code is invalid');
      }
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, '2FA method not specified');
    }
  }

  // First time QR verification after enabling to set user attributes
  async verifyAuthenticatorCode(user: User, code: string): Promise<string> {
    if (user.hasTwoFA) {
      return '2FA already enabled';
    }
    const secret = await TwoFactorSecret.getInstance().findOne({
      user: user._id,
    });
    if (isNil(secret)) throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');
    const verification = node2fa.verifyToken(secret.secret, code, 1);
    if (isNil(verification) || verification.delta !== 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Code is not correct');
    }
    await User.getInstance().findByIdAndUpdate(user._id, {
      hasTwoFA: true,
    });
    this.grpcSdk.bus?.publish(
      'authentication:enableTwofa:user',
      JSON.stringify({ id: user._id }),
    );
    return '2FA enabled';
  }

  // First time phone verification after enabling to set user attributes
  async verifyPhoneNumber(user: User, code: string): Promise<string> {
    if (user.hasTwoFA) {
      return '2FA already enabled';
    }
    const verificationRecord: Token | null = await Token.getInstance().findOne({
      user: user._id,
      type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
    });
    if (isNil(verificationRecord))
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'No verification record for this user',
      );
    const verified = await this.smsModule.verify(verificationRecord.token, code);
    if (!verified.verified) {
      throw new GrpcError(status.UNAUTHENTICATED, 'email and code do not match');
    }
    await Token.getInstance()
      .deleteMany({
        user: user._id,
        type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    await User.getInstance().findByIdAndUpdate(user._id, {
      phoneNumber: verificationRecord.data.phoneNumber,
      hasTwoFA: true,
    });
    this.grpcSdk.bus?.publish(
      'authentication:enableTwofa:user',
      JSON.stringify({
        id: user._id,
        phoneNumber: verificationRecord.data.phoneNumber,
      }),
    );
    return '2FA enabled';
  }

  private async verifyAuthenticatorCodeForLogin(
    clientId: string,
    user: User,
    code: string,
  ): Promise<{ userId?: string; accessToken?: string; refreshToken?: string }> {
    const secret = await TwoFactorSecret.getInstance().findOne({
      user: user._id,
    });
    if (isNil(secret)) throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');

    const verification = node2fa.verifyToken(secret.secret, code);
    if (isNil(verification) || verification.delta !== 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Code is not correct');
    }
    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: user._id,
        clientId,
      }),
    );
    const config = ConfigController.getInstance().config;
    return TokenProvider.getInstance()!.provideUserTokens({
      user,
      clientId,
      config,
    });
  }
}
