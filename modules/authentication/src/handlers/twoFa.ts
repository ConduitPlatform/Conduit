import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  Indexable,
  ParsedRouterRequest,
  SMS,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitString,
  ConfigController,
  RoutingManager,
  ModuleError,
} from '@conduitplatform/module-tools';
import { isNil } from 'lodash-es';
import { Token, TwoFactorBackUpCodes, TwoFactorSecret, User } from '../models/index.js';
import { AuthUtils } from '../utils/index.js';
import { sessionRealmId } from './realmRequest.js';
import { assertIdentifierFreeForUser, identifierQuery } from '../utils/realm.js';
import { TokenType, TWO_FA_CHALLENGE } from '../constants/index.js';
import * as node2fa from '@conduitplatform/node-2fa';
import { v4 as uuid } from 'uuid';
import { TokenProvider } from './tokenProvider.js';
import { resolveTotpIssuer } from './totpIssuer.js';
import { Config } from '../config/index.js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { randomInt } from 'crypto';
import { errors } from '../errors.js';
import {
  ANONYMOUS_DENIED_ERRORS,
  AUTHENTICATED_TOKEN_ERRORS,
  SESSION_AUTH_ERRORS,
} from './utils.js';

function normalizeTwoFaMethod(method?: string): string | undefined {
  if (method === 'phone') {
    return 'sms';
  }
  return method;
}

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
    const config: Config = ConfigController.getInstance().config;
    const authRouteMiddlewares = ['authMiddleware'];
    if (config.anonymousUsers) {
      authRouteMiddlewares.push('denyAnonymousMiddleware');
    }
    routingManager.route(
      {
        path: '/twoFa/authorize',
        action: ConduitRouteActions.POST,
        description: `Starts 2FA process by sending a code to user's phone
                      or returns a message to check authenticator app.
                      User's 2FA mechanism has to be enabled.`,
        middlewares: ['authMiddleware'],
        errors: [
          errors.TWO_FA_METHOD_UNAVAILABLE,
          errors.VERIFICATION_CODE_SEND_FAILED,
          ...SESSION_AUTH_ERRORS,
        ],
        rateLimit: TWO_FA_CHALLENGE,
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
        errors: [
          errors.CODE_VERIFICATION_FAILED,
          errors.VERIFICATION_CODE_INVALID,
          errors.TOTP_SECRET_NOT_FOUND,
          errors.TWO_FA_METHOD_UNAVAILABLE,
          ...SESSION_AUTH_ERRORS,
          ...AUTHENTICATED_TOKEN_ERRORS,
        ],
        rateLimit: TWO_FA_CHALLENGE,
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
        errors: [
          errors.CODE_VERIFICATION_FAILED,
          errors.VERIFICATION_CODE_INVALID,
          errors.TOTP_SECRET_NOT_FOUND,
          errors.PHONE_VERIFICATION_NOT_FOUND,
          errors.PHONE_NUMBER_TAKEN,
          ...SESSION_AUTH_ERRORS,
        ],
        rateLimit: TWO_FA_CHALLENGE,
      },
      new ConduitRouteReturnDefinition('VerifyAuthenticatorResponse', 'String'),
      this.verifyCode.bind(this),
    );
    routingManager.route(
      {
        path: '/twoFa/enable',
        action: ConduitRouteActions.UPDATE,
        description: `Enables a phone or qr based 2FA method for a user and 
                requires their phone number in case of phone 2FA.
                Authenticator setup accepts an optional issuer from twoFa.allowedIssuers.`,
        middlewares: authRouteMiddlewares,
        bodyParams: {
          method: ConduitString.Required,
          phoneNumber: ConduitString.Optional,
          issuer: ConduitString.Optional,
        },
        errors: [
          errors.SUDO_REQUIRED,
          errors.TWO_FA_METHOD_INVALID,
          errors.TOTP_ISSUER_NOT_ALLOWED,
          errors.VERIFICATION_RESEND_THROTTLED,
          errors.VERIFICATION_CODE_SEND_FAILED,
          ...ANONYMOUS_DENIED_ERRORS,
          ...SESSION_AUTH_ERRORS,
        ],
      },
      new ConduitRouteReturnDefinition('EnableTwoFaResponse', 'String'),
      this.enableTwoFa.bind(this),
    );

    routingManager.route(
      {
        path: '/twoFa/disable',
        action: ConduitRouteActions.UPDATE,
        description: `Disables the user's 2FA mechanism.`,
        middlewares: authRouteMiddlewares,
        errors: [
          errors.SUDO_REQUIRED,
          errors.AUTHENTICATION_REQUIRED,
          ...ANONYMOUS_DENIED_ERRORS,
          ...SESSION_AUTH_ERRORS,
        ],
      },
      new ConduitRouteReturnDefinition('DisableTwoFaResponse', 'String'),
      this.disableTwoFa.bind(this),
    );

    if (ConfigController.getInstance().config.twoFa.backUpCodes?.enabled) {
      routingManager.route(
        {
          path: '/twoFa/generate',
          action: ConduitRouteActions.GET,
          description: `Generates a new set of back up codes for 2FA.`,
          middlewares: authRouteMiddlewares,
          errors: [
            errors.SUDO_REQUIRED,
            errors.AUTHENTICATION_REQUIRED,
            ...ANONYMOUS_DENIED_ERRORS,
            ...SESSION_AUTH_ERRORS,
          ],
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
          middlewares: authRouteMiddlewares,
          bodyParams: {
            code: ConduitString.Required,
          },
          errors: [
            errors.BACKUP_CODE_FORMAT_INVALID,
            errors.BACKUP_CODES_NOT_FOUND,
            errors.BACKUP_CODE_INVALID,
            ...ANONYMOUS_DENIED_ERRORS,
            ...SESSION_AUTH_ERRORS,
            ...AUTHENTICATED_TOKEN_ERRORS,
          ],
          rateLimit: TWO_FA_CHALLENGE,
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
    const twoFaMethod = normalizeTwoFaMethod(user.twoFaMethod);
    if (twoFaMethod === 'sms') {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.smsModule,
        user.phoneNumber!,
      );
      if (verificationSid === '') {
        throw new ModuleError(errors.VERIFICATION_CODE_SEND_FAILED);
      }
      // hide user phone number digits besides the first two and last two digits
      const phoneNumber = user.phoneNumber!.replace(/(\d{2})\d*(\d{2})/, '$1****$2');
      return {
        method: 'sms',
        message: `A verification code has been sent to ${phoneNumber}`,
      };
    } else if (twoFaMethod === 'authenticator') {
      return {
        method: 'authenticator',
        message: `Use your authenticator app to get the code`,
      };
    } else {
      throw new ModuleError(errors.TWO_FA_METHOD_UNAVAILABLE);
    }
  }

  async enableTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!call.request.context.jwtPayload.sudo) {
      throw new ModuleError(errors.SUDO_REQUIRED);
    }
    const { method, phoneNumber, issuer } = call.request.params;
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
      return this.enableAuthenticator2Fa(user, issuer);
    } else {
      throw new ModuleError(errors.TWO_FA_METHOD_INVALID);
    }
  }

  async verify2FA(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const clientId = context.clientId;
    const { code } = call.request.params;
    return this.verifyAuthentication(
      context.user,
      code,
      clientId,
      sessionRealmId(context),
    );
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
      throw new ModuleError(errors.SUDO_REQUIRED);
    }
    const context = call.request.context;
    if (isNil(context) || isNil(context.user)) {
      throw new ModuleError(errors.AUTHENTICATION_REQUIRED);
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
    const twoFaMethod = normalizeTwoFaMethod(user.twoFaMethod);
    if (twoFaMethod === 'sms') {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.smsModule,
        user.phoneNumber!,
      );
      if (verificationSid === '') {
        throw new ModuleError(errors.VERIFICATION_CODE_SEND_FAILED);
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
    } else if (twoFaMethod === 'authenticator') {
      const secret = await TwoFactorSecret.getInstance().findOne(
        {
          user: user._id,
        },
        { readPreference: 'primary' },
      );
      if (isNil(secret)) throw new ModuleError(errors.TOTP_SECRET_NOT_FOUND);
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
      throw new ModuleError(errors.TWO_FA_METHOD_UNAVAILABLE);
    }
  }

  async verifyAuthentication(
    user: User,
    code: string,
    clientId: string,
    realm: string | null = null,
  ): Promise<{ userId?: string; accessToken?: string; refreshToken?: string }> {
    const twoFaMethod = normalizeTwoFaMethod(user.twoFaMethod);
    if (twoFaMethod === 'sms') {
      const token = await Token.getInstance().findOne(
        {
          tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
          user: user._id,
        },
        { readPreference: 'primary' },
      );
      if (!token) {
        throw new ModuleError(errors.CODE_VERIFICATION_FAILED);
      }
      const verificationSid = token.data?.verification ?? token.token;
      const verified = await this.grpcSdk.sms!.verify(verificationSid, code);
      if (!verified.verified) {
        throw new ModuleError(errors.CODE_VERIFICATION_FAILED);
      }
      const consumed = await Token.getInstance().deleteOne({
        _id: token._id,
        user: user._id,
        tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
      });
      if (consumed.deletedCount === 0) {
        throw new ModuleError(errors.CODE_VERIFICATION_FAILED);
      }
      const config = ConfigController.getInstance().config;
      return TokenProvider.getInstance().provideUserTokens({
        user,
        clientId,
        config,
        twoFaPass: true,
        realm,
      });
    } else if (user.twoFaMethod == 'authenticator') {
      return this.verifyAuthenticatorCodeForLogin(clientId, user, code, realm);
    } else {
      throw new ModuleError(errors.TWO_FA_METHOD_UNAVAILABLE);
    }
  }

  // First time QR verification after enabling to set user attributes
  async verifyAuthenticatorCode(user: User, code: string): Promise<string> {
    if (user.hasTwoFA) {
      return '2FA already enabled';
    }
    const secret = await TwoFactorSecret.getInstance().findOne(
      {
        user: user._id,
      },
      { readPreference: 'primary' },
    );
    if (isNil(secret)) throw new ModuleError(errors.TOTP_SECRET_NOT_FOUND);
    const verification = node2fa.verifyToken(secret.secret, code, 1);
    if (isNil(verification) || verification.delta !== 0) {
      throw new ModuleError(errors.VERIFICATION_CODE_INVALID);
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
    const verificationRecord: Token | null = await Token.getInstance().findOne(
      {
        user: user._id,
        tokenType: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      },
      { readPreference: 'primary' },
    );
    if (isNil(verificationRecord))
      throw new ModuleError(errors.PHONE_VERIFICATION_NOT_FOUND);
    const verificationSid =
      verificationRecord.data?.verification ?? verificationRecord.token;
    const verified = await this.grpcSdk.sms!.verify(verificationSid, code);
    if (!verified.verified) {
      throw new ModuleError(errors.CODE_VERIFICATION_FAILED);
    }
    const phoneNumber = verificationRecord.data?.phoneNumber;
    if (typeof phoneNumber === 'string' && phoneNumber !== '') {
      // the number becomes the login identifier of the user: it must be free in its scope
      await assertIdentifierFreeForUser(
        user,
        identifierQuery('phoneNumber', phoneNumber),
        'Phone number already exists',
      );
    }
    const consumed = await Token.getInstance().deleteOne({
      _id: verificationRecord._id,
      user: user._id,
      tokenType: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
    });
    if (consumed.deletedCount === 0) {
      throw new ModuleError(errors.CODE_VERIFICATION_FAILED);
    }
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
      throw new ModuleError(errors.SUDO_REQUIRED);
    }
    const context = call.request.context;
    if (isNil(context) || isNil(context.user)) {
      throw new ModuleError(errors.AUTHENTICATION_REQUIRED);
    }
    return this.codeGenerator(context.user);
  }

  async recoverTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user, clientId } = call.request.context;
    const { code } = call.request.params;
    const realm = sessionRealmId(call.request.context);
    const reg = /^\d{8}$/;
    if (!reg.test(code)) {
      throw new ModuleError(errors.BACKUP_CODE_FORMAT_INVALID);
    }
    const codeSet = await TwoFactorBackUpCodes.getInstance().findOne(
      { user: user._id },
      { readPreference: 'primary' },
    );
    if (isNil(codeSet)) {
      throw new ModuleError(errors.BACKUP_CODES_NOT_FOUND);
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
      throw new ModuleError(errors.BACKUP_CODE_INVALID);
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
      realm,
    });

    result.message = `You have ${codeSet.codes.length} back up codes left`;
    return result;
  }

  private async enableSms2Fa(
    context: Indexable,
    user: User,
    phoneNumber: string,
  ): Promise<string> {
    const existingToken = await Token.getInstance().findOne(
      {
        tokenType: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
        user: user._id,
      },
      { readPreference: 'primary' },
    );
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
      throw new ModuleError(errors.VERIFICATION_CODE_SEND_FAILED);
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
      twoFaMethod: 'sms',
    });
    return 'Verification code sent';
  }

  private async enableAuthenticator2Fa(
    user: User,
    requestedIssuer?: string,
  ): Promise<string> {
    const { issuer, allowedIssuers } = ConfigController.getInstance().config.twoFa;
    const secret = await node2fa.generateSecret({
      name: resolveTotpIssuer({ issuer, allowedIssuers }, requestedIssuer),
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
    realm: string | null = null,
  ): Promise<{ userId?: string; accessToken?: string; refreshToken?: string }> {
    const secret = await TwoFactorSecret.getInstance().findOne(
      {
        user: user._id,
      },
      { readPreference: 'primary' },
    );
    if (isNil(secret)) throw new ModuleError(errors.TOTP_SECRET_NOT_FOUND);

    const verification = node2fa.verifyToken(secret.secret, code);
    if (isNil(verification) || verification.delta !== 0) {
      throw new ModuleError(errors.VERIFICATION_CODE_INVALID);
    }
    const config = ConfigController.getInstance().config;
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId,
      config,
      twoFaPass: true,
      realm,
    });
  }

  private async codeGenerator(user: User): Promise<string[]> {
    const codes = [];
    const hashedCodes = [];
    for (let i = 0; i < 10; i++) {
      codes[i] = (randomInt(1000, 10000) + ' ' + randomInt(1000, 10000)).toString();
      hashedCodes[i] = await AuthUtils.hashPassword(codes[i].split(' ').join(''));
    }
    const codeSet = await TwoFactorBackUpCodes.getInstance().findOne(
      { user: user._id },
      { readPreference: 'primary' },
    );
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
