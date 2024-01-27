import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  SMS,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { Token, TwoFactorBackUpCodes, TwoFactorSecret, User } from '../models/index.js';
import { AuthUtils } from '../utils/index.js';
import { TokenType } from '../constants/index.js';
import * as node2fa from '@conduitplatform/node-2fa';
import { v4 as uuid } from 'uuid';
import { TokenProvider } from './tokenProvider.js';
import { Config } from '../config/index.js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { randomInt } from 'crypto';

export class TwoFa implements IAuthenticationStrategy {
  private smsModule: SMS;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const authConfig: Config = ConfigController.getInstance().config;
    if (!authConfig.twoFa.enabled) {
      ConduitGrpcSdk.Logger.log('TwoFactor authentication not available');
      return false;
    }
    if (authConfig.twoFa.enabled && authConfig.twoFa.methods.sms) {
      if (!this.grpcSdk.isAvailable('sms')) {
        ConduitGrpcSdk.Logger.error('SMS module not available');
        return false;
      }
    }
    ConduitGrpcSdk.Logger.log('TwoFactor authentication is available');
    return true;
  }

  declareRoutes(routingManager: RoutingManager): void {
    routingManager.route(
      {
        path: '/twoFa/authorize',
        action: ConduitRouteActions.POST,
        description: `Starts 2FA process by sending a code to user's phone
                      or returns a message to check authenticator app.
                      User's 2FA mechanism has to be enabled.`,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('BeginTwoFaResponse', {
        method: ConduitString.Required,
        message: ConduitString.Required,
      }),
      this.beginTwoFa.bind(this),
    );

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
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
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

    if (ConfigController.getInstance().config.twoFa.backUpCodes) {
      routingManager.route(
        {
          path: '/twoFa/generate',
          action: ConduitRouteActions.GET,
          description: `Generates a new set of back up codes for 2FA.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('GenerateTwoFaBackUpCodesResponse', {
          codes: [ConduitString.Required],
        }),
        this.generateBackUpCodes.bind(this),
      );

      routingManager.route(
        {
          path: '/twoFa/recover',
          action: ConduitRouteActions.POST,
          description: `Recovers 2FA access with an 8 digit backup code.`,
          middlewares: ['authMiddleware'],
          bodyParams: {
            code: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('RecoverTwoFaAccessResponse', {
          accessToken: ConduitString.Optional,
          refreshToken: ConduitString.Optional,
          message: ConduitString.Optional,
        }),
        this.recoverTwoFa.bind(this),
      );
    }
  }

  async beginTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const user: User = call.request.context.user;
    if (!user.hasTwoFA) {
      return '2FA disabled';
    }
    if (user.twoFaMethod === 'sms') {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.smsModule,
        user.phoneNumber!,
      );
      if (verificationSid === '') {
        throw new GrpcError(status.INTERNAL, 'Could not send verification code');
      }
      // hide user phone number digits besides the first two and last two digits
      const phoneNumber = user.phoneNumber!.replace(/(\d{2})\d*(\d{2})/, '$1****$2');
      return {
        method: 'sms',
        message: `A verification code has been sent to ${phoneNumber}`,
      };
    } else if (user.twoFaMethod === 'authenticator') {
      return {
        method: 'authenticator',
        message: `Use your authenticator app to get the code`,
      };
    } else {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid method');
    }
  }

  async enableTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!call.request.context.jwtPayload.sudo) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
    const { method, phoneNumber } = call.request.params;
    const context = call.request.context;
    const user = context.user;
    if (user.hasTwoFA) {
      return '2FA already enabled';
    }
    if (method === 'sms' && ConfigController.getInstance().config.twoFa.methods.sms) {
      return this.enableSms2Fa(context, user, phoneNumber!);
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
    if (!call.request.context.jwtPayload.sudo) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
    const context = call.request.context;
    if (isNil(context) || isNil(context.user)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
    }
    const user = context.user;
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
          tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      await Token.getInstance().create({
        user: user._id,
        tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
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
          tokenType: TokenType.AUTHENTICATOR_VERIFICATION_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
      const qrVerificationToken = await Token.getInstance().create({
        user: user._id,
        tokenType: TokenType.AUTHENTICATOR_VERIFICATION_TOKEN,
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
      const token = await Token.getInstance().findOne({
        tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
        user: user._id,
      });
      if (!token) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Code verification unsuccessful');
      }
      const verified = await AuthUtils.verifyCode(this.grpcSdk, token, code);
      if (!verified) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Code verification unsuccessful');
      }
      const config = ConfigController.getInstance().config;
      return TokenProvider.getInstance().provideUserTokens({
        user,
        clientId,
        config,
        twoFaPass: true,
      });
    } else if (user.twoFaMethod == 'authenticator') {
      return this.verifyAuthenticatorCodeForLogin(clientId, user, code);
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Method not valid');
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
      tokenType: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
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
        tokenType: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
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

  async generateBackUpCodes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!call.request.context.jwtPayload.sudo) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
    const context = call.request.context;
    if (isNil(context) || isNil(context.user)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
    }
    return this.codeGenerator(context.user);
  }

  async recoverTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user, clientId } = call.request.context;
    const { code } = call.request.params;
    const reg = /^\d{8}$/;
    if (!reg.test(code)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Incorrect code format');
    }
    const codeSet = await TwoFactorBackUpCodes.getInstance().findOne({ user: user._id });
    if (isNil(codeSet)) {
      throw new GrpcError(status.NOT_FOUND, 'User has no back up codes');
    }
    let codeMatch;
    for (const hashedCode of codeSet.codes) {
      codeMatch = await AuthUtils.checkPassword(code, hashedCode);
      if (codeMatch) {
        const index = codeSet.codes.indexOf(hashedCode);
        codeSet.codes.splice(index, 1);
        break;
      }
    }
    if (!codeMatch) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid code');
    }
    if (codeSet.codes.length === 0) {
      await TwoFactorBackUpCodes.getInstance().deleteOne({ _id: codeSet._id });
    } else {
      await TwoFactorBackUpCodes.getInstance().findByIdAndUpdate(codeSet._id, {
        codes: codeSet.codes,
      });
    }
    const config = ConfigController.getInstance().config;
    const result: any = await TokenProvider.getInstance().provideUserTokens({
      user,
      clientId,
      config,
      twoFaPass: true,
    });
    result.message = `You have ${codeSet.codes.length} back up codes left`;
    return result;
  }

  private async enableSms2Fa(
    context: Indexable,
    user: User,
    phoneNumber: string,
  ): Promise<string> {
    const existingToken = await Token.getInstance().findOne({
      tokenType: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      user: user._id,
    });
    if (existingToken) {
      AuthUtils.checkResendThreshold(existingToken);
      await Token.getInstance().deleteMany({
        tokenType: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
        user: user._id,
      });
    }
    const verificationSid = await AuthUtils.sendVerificationCode(
      this.smsModule,
      phoneNumber,
    );
    if (verificationSid === '') {
      throw new GrpcError(status.INTERNAL, 'Could not send verification code');
    }

    await Token.getInstance().create({
      tokenType: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      user: user._id,
      data: {
        clientId: context.clientId,
        phone: phoneNumber,
        verification: verificationSid,
      },
      token: uuid(),
    });
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
    const config = ConfigController.getInstance().config;
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId,
      config,
      twoFaPass: true,
    });
  }

  private async codeGenerator(user: User): Promise<string[]> {
    const codes = [];
    const hashedCodes = [];
    for (let i = 0; i < 10; i++) {
      codes[i] = (randomInt(1000, 10000) + ' ' + randomInt(1000, 10000)).toString();
      hashedCodes[i] = await AuthUtils.hashPassword(codes[i].split(' ').join(''));
    }
    const codeSet = await TwoFactorBackUpCodes.getInstance().findOne({ user: user._id });
    if (isNil(codeSet)) {
      await TwoFactorBackUpCodes.getInstance().create({
        user: user._id,
        codes: hashedCodes,
      });
    } else {
      await TwoFactorBackUpCodes.getInstance().findByIdAndUpdate(codeSet._id, {
        codes: hashedCodes,
      });
    }
    return codes;
  }
}
