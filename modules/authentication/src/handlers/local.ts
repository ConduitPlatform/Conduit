import { isEmpty, isNil } from 'lodash';
import { AuthUtils } from '../utils/auth';
import { TokenType } from '../constants/TokenType';
import { v4 as uuid } from 'uuid';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';
import ConduitGrpcSdk, {
  ConduitError,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import * as grpc from 'grpc';
import * as templates from '../templates';
import { ConfigController } from '../config/Config.controller';
import moment = require('moment');

export class LocalHandlers {
  private database: any;
  private emailModule: any;
  private sms: any;
  private initialized: boolean = false;
  private identifier: string = 'email';

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<Boolean> {
    const config = ConfigController.getInstance().config;
    let promise: Promise<void>;
    this.identifier = config.local.identifier;
    if (this.identifier !== 'username') {
      promise = this.grpcSdk.config.get('email')
        .then((emailConfig: any) => {
          if (!emailConfig.active) {
            throw ConduitError.forbidden(
              'Cannot use local authentication without email module being enabled'
            );
          }
        });
    } else {
      promise = Promise.resolve();
    }

    return promise
      .then(() => {
        if (!this.initialized) {
          return this.initDbAndEmail();
        }
      })
      .then((r) => {
        console.log('Local is active');
        return true;
      })
      .catch((err: Error) => {
        console.log('Local not active');
        // De-initialize the provider if the config is now invalid
        this.initialized = false;
        throw err;
      });
  }

  async register(call: RouterRequest, callback: RouterResponse) {
    if (!this.initialized)
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested resource not found',
      });
    let { email, password } = JSON.parse(call.request.params);
    let errorMessage = null;

    if (isNil(email) || isNil(password))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Email and password required',
      });

    if (email.indexOf('+') !== -1) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Email contains unsupported characters',
      });
    }

    email = email.toLowerCase();

    let user = await this.database
      .findOne('User', { email })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (!isNil(user))
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        message: 'User already exists',
      });

    user = await AuthUtils.hashPassword(password)
      .then((hashedPassword: string) => {
        const isVerified = this.identifier === 'username';
        return this.database.create('User', { email, hashedPassword, isVerified });
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const config = ConfigController.getInstance().config;

    let serverConfig = await this.grpcSdk.config
      .getServerConfig()
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    let url = serverConfig.url;

    if (config.local.identifier === 'email' && config.local.sendVerificationEmail) {
      this.database
        .create('Token', {
          type: TokenType.VERIFICATION_TOKEN,
          userId: user._id,
          token: uuid(),
        })
        .then((verificationToken: any) => {
          return { verificationToken, hostUrl: url };
        })
        .then((result: { hostUrl: Promise<any>; verificationToken: any }) => {
          const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
          return this.emailModule.sendEmail('EmailVerification', {
            email: user.email,
            sender: 'no-reply',
            variables: {
              link,
            },
          });
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, {
      result: JSON.stringify({ message: 'Registration was successful' }),
    });
  }

  async authenticate(call: RouterRequest, callback: RouterResponse) {
    if (!this.initialized)
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested resource not found',
      });
    let { email, password } = JSON.parse(call.request.params);
    const context = JSON.parse(call.request.context);
    let errorMessage = null;

    if (isNil(context))
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    const clientId = context.clientId;

    if (isNil(email) || isNil(password))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Email and password required',
      });

    if (email.indexOf('+') !== -1) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Email contains unsupported characters',
      });
    }

    email = email.toLowerCase();

    const user = await this.database
      .findOne('User', { email }, '+hashedPassword')
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(user))
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid login credentials',
      });
    if (!user.active)
      return callback({ code: grpc.status.PERMISSION_DENIED, message: 'Inactive user' });

    const passwordsMatch = await AuthUtils.checkPassword(
      password,
      user.hashedPassword
    ).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (!passwordsMatch)
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid login credentials',
      });

    const config = ConfigController.getInstance().config;
    if (config.local.verificationRequired && !user.isVerified) {
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: 'You must verify your account to login',
      });
    }

    if (user.hasTwoFA) {
      const verificationSid = await this.sendVerificationCode(user.phoneNumber);
      if (verificationSid === '') {
        return callback({
          code: grpc.status.INTERNAL,
          message: 'Could not send verification code',
        });
      }

      await this.database
        .deleteMany('Token', { userId: user._id, type: TokenType.TWO_FA_VERIFICATION_TOKEN })
        .catch(console.error);

      await this.database
        .create('Token', {
          userId: user._id,
          type: TokenType.TWO_FA_VERIFICATION_TOKEN,
          token: verificationSid,
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });

      return callback(null, {
        result: JSON.stringify({
          message: 'Verification code sent',
        }),
      });
    }

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: user._id,
        clientId,
      })
    ).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };

    const accessToken = await this.database
      .create('AccessToken', {
        userId: user._id,
        clientId,
        token: AuthUtils.signToken({ id: user._id }, signTokenOptions),
        expiresOn: moment()
          .add(config.tokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const refreshToken = await this.database
      .create('RefreshToken', {
        userId: user._id,
        clientId,
        token: AuthUtils.randomToken(),
        expiresOn: moment()
          .add(config.refreshTokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({
        userId: user._id.toString(),
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
      }),
    });
  }

  async forgotPassword(call: RouterRequest, callback: RouterResponse) {
    if (!this.initialized || isNil(this.emailModule)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested resource not found',
      });
    }

    const { email } = JSON.parse(call.request.params);
    const config = ConfigController.getInstance().config;
    let errorMessage = null;

    const user = await this.database
      .findOne('User', { email })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(user) || (config.local.verificationRequired && !user.isVerified))
      return callback(null, { result: JSON.stringify({ message: 'Ok' }) });

    this.database
      .findOne('Token', { type: TokenType.PASSWORD_RESET_TOKEN, userId: user._id })
      .then((oldToken: any) => {
        if (!isNil(oldToken)) return this.database.deleteOne('Token', oldToken);
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const passwordResetTokenDoc = await this.database
      .create('Token', {
        type: TokenType.PASSWORD_RESET_TOKEN,
        userId: user._id,
        token: uuid(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    let appUrl = config.local.forgot_password_redirect_uri;
    const link = `${appUrl}?reset_token=${passwordResetTokenDoc.token}`;
    let mail = await this.emailModule
      .sendEmail('ForgotPassword', {
        email: user.email,
        sender: 'no-reply',
        variables: {
          link,
        },
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    return callback(null, { result: JSON.stringify({ message: 'Ok' }) });
  }

  async resetPassword(call: RouterRequest, callback: RouterResponse) {
    if (!this.initialized || isNil(this.emailModule)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested resource not found',
      });
    }

    const {
      passwordResetToken: passwordResetTokenParam,
      password: newPassword,
    } = JSON.parse(call.request.params);

    let errorMessage = null;

    const passwordResetTokenDoc = await this.database
      .findOne('Token', {
        type: TokenType.PASSWORD_RESET_TOKEN,
        token: passwordResetTokenParam,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(passwordResetTokenDoc))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid parameters',
      });

    const user = await this.database
      .findOne('User', { _id: passwordResetTokenDoc.userId }, '+hashedPassword')
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(user))
      return callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });

    const passwordsMatch = await AuthUtils.checkPassword(
      newPassword,
      user.hashedPassword
    ).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (passwordsMatch)
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: "Password can't be the same as the old one",
      });

    user.hashedPassword = await AuthUtils.hashPassword(newPassword).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const userPromise = this.database.findByIdAndUpdate('User', user._id, user);
    const tokenPromise = this.database.deleteOne('Token', passwordResetTokenDoc);

    await Promise.all(
      [userPromise, tokenPromise].concat(
        AuthUtils.deleteUserTokens(this.grpcSdk, {
          userId: user._id,
        })
      )
    ).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({ message: 'Password reset successful' }),
    });
  }

  async changePassword(call: RouterRequest, callback: RouterResponse) {
    const { oldPassword, newPassword } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    if (oldPassword === newPassword) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'The new password can not be the same as the old password' });
    }

    let errorMessage: string | null = null;
    const dbUser = await this.database.findOne('User', { _id: user._id }, '+hashedPassword')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    if (isNil(dbUser)) {
      return callback({ code: grpc.status.UNAUTHENTICATED, message: 'user does not exist' });
    }

    const passwordsMatch = await AuthUtils.checkPassword(
      oldPassword,
      dbUser.hashedPassword
    ).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (!passwordsMatch) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid password',
      });
    }

    const hashedPassword = await AuthUtils.hashPassword(newPassword)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    if (dbUser.hasTwoFA) {
      const verificationSid = await this.sendVerificationCode(dbUser.phoneNumber);
      if (verificationSid === '') {
        return callback({
          code: grpc.status.INTERNAL,
          message: 'Could not send verification code',
        });
      }

      await this.database
        .deleteMany('Token', { userId: dbUser._id, type: TokenType.CHANGE_PASSWORD_TOKEN })
        .catch(console.error);

      await this.database
        .create('Token', {
          userId: dbUser._id,
          type: TokenType.CHANGE_PASSWORD_TOKEN,
          token: verificationSid,
          data: {
            password: hashedPassword
          }
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });

      return callback(null, { result: 'Verification code sent' });
    }

    this.database.findByIdAndUpdate('User', dbUser._id, { hashedPassword })
      .then(() => {
        callback(null, { result: 'Password changed successfully' });
      })
      .catch((e: Error) => {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      });
  }

  async verifyChangePassword(call: RouterRequest, callback: RouterResponse) {
    const { code } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    let errorMessage: string | null = null;
    const token = await this.database.findOne('Token', { userId: user._id, type: TokenType.CHANGE_PASSWORD_TOKEN })
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    if (isNil(token)) {
      return callback({ code: grpc.status.INTERNAL, message: 'User has no active change_password token' });
    }

    const verified = await this.sms.verify(token.token, code)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    if (!verified) {
      return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Invalid code' });
    }

    await this.database.deleteMany('Token', { userId: user._id, type: TokenType.CHANGE_PASSWORD_TOKEN })
      .catch(console.error);

    this.database.findByIdAndUpdate('User', user._id, { hashedPassword: token.data.password })
      .then(() => {
        callback(null, { result: 'Password changed successfully' });
      })
      .catch((e: Error) => {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      });
  }

  async verifyEmail(call: RouterRequest, callback: RouterResponse) {
    if (!this.initialized)
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested resource not found',
      });

    const verificationTokenParam = JSON.parse(call.request.params).verificationToken;
    if (isNil(verificationTokenParam))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid parameters',
      });

    let errorMessage = null;
    const config = ConfigController.getInstance().config;

    const verificationTokenDoc = await this.database
      .findOne('Token', {
        type: TokenType.VERIFICATION_TOKEN,
        token: verificationTokenParam,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(verificationTokenDoc)) {
      if (config.local.verification_redirect_uri) {
        return callback(null, { redirect: config.local.verification_redirect_uri });
      } else {
        return callback(null, { result: JSON.stringify({ message: 'Email verified' }) });
      }
    }

    const user = await this.database
      .findOne('User', { _id: verificationTokenDoc.userId })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(user))
      return callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });

    user.isVerified = true;
    const userPromise = this.database.findByIdAndUpdate('User', user._id, user);
    const tokenPromise = this.database.deleteOne('Token', verificationTokenDoc);

    await Promise.all([userPromise, tokenPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (config.local.verification_redirect_uri) {
      return callback(null, { redirect: config.local.verification_redirect_uri });
    } else {
      return callback(null, { result: JSON.stringify({ message: 'Email verified' }) });
    }
  }

  async verify(call: RouterRequest, callback: RouterResponse) {
    const context = JSON.parse(call.request.context);
    if (isNil(context) || isEmpty(context))
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });

    const clientId = context.clientId;

    const { email, code } = JSON.parse(call.request.params);

    let errorMessage = null;
    const user = await this.database
      .findOne('User', { email })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(user))
      return callback({ code: grpc.status.UNAUTHENTICATED, message: 'User not found' });

    const verificationRecord = await this.database
      .findOne('Token', { userId: user._id, type: TokenType.TWO_FA_VERIFICATION_TOKEN })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(verificationRecord))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'No verification record for this user',
      });

    const verified = await this.sms
      .verify(verificationRecord.token, code)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (!verified) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'email and code do not match',
      });
    }

    await this.database
      .deleteMany('Token', { userId: user._id, type: TokenType.TWO_FA_VERIFICATION_TOKEN })
      .catch(console.error);

    const config = ConfigController.getInstance().config;

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: user._id,
        clientId,
      })
    ).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };

    const accessToken = await this.database
      .create('AccessToken', {
        userId: user._id,
        clientId,
        token: AuthUtils.signToken({ id: user._id }, signTokenOptions),
        expiresOn: moment()
          .add(config.tokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const refreshToken = await this.database
      .create('RefreshToken', {
        userId: user._id,
        clientId,
        token: AuthUtils.randomToken(),
        expiresOn: moment()
          .add(config.refreshTokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({
        userId: user._id.toString(),
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
      }),
    });
  }

  async enableTwoFa(call: RouterRequest, callback: RouterResponse) {
    const { phoneNumber } = JSON.parse(call.request.params);
    const context = JSON.parse(call.request.context);

    if (isNil(context) || isNil(context.user)) {
      return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Unauthorized' });
    }

    let errorMessage: string | null = null;
    const verificationSid = await this.sendVerificationCode(phoneNumber);
    if (verificationSid === '') {
      return callback({
        code: grpc.status.INTERNAL,
        message: 'Could not send verification code',
      });
    }

    await this.database
      .deleteMany('Token', { userId: context.user._id, type: TokenType.VERIFY_PHONE_NUMBER_TOKEN })
      .catch(console.error);

    await this.database
      .create('Token', {
        userId: context.user._id,
        type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
        token: verificationSid,
        data: {
          phoneNumber
        },
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({
        message: 'Verification code sent',
      }),
    });
  }

  async verifyPhoneNumber(call: RouterRequest, callback: RouterResponse) {
    const context = JSON.parse(call.request.context);
    const { code } = JSON.parse(call.request.params);

    if (isNil(context) || isEmpty(context)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }

    let errorMessage: string | null = null;
    const verificationRecord = await this.database
      .findOne('Token', {
        userId: context.user._id,
        type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(verificationRecord))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'No verification record for this user',
      });

    const verified = await this.sms
      .verify(verificationRecord.token, code)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (!verified) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'email and code do not match',
      });
    }

    await this.database
      .deleteMany('Token', { userId: context.user._id, type: TokenType.VERIFY_PHONE_NUMBER_TOKEN })
      .catch(console.error);

    await this.database
      .findByIdAndUpdate('User', context.user._id, {
        phoneNumber: verificationRecord.data.phoneNumber,
        hasTwoFA: true,
      })
      .catch((e: any) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, {
      result: JSON.stringify({
        message: 'twofa enabled',
      }),
    });
  }

  async disableTwoFa(call: RouterRequest, callback: RouterResponse) {
    const context = JSON.parse(call.request.context);
    if (isNil(context) || isNil(context.user)) {
      return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Unauthorized' });
    }

    let errorMessage: string | null = null;
    await this.database
      .findByIdAndUpdate('User', context.user._id, {
        hasTwoFA: false,
      })
      .catch((e: any) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, {
      result: JSON.stringify({
        message: 'twofa disabled',
      }),
    });
  }

  private async initDbAndEmail() {
    const config = ConfigController.getInstance().config;

    this.database = this.grpcSdk.databaseProvider;

    if (config.local.identifier !== 'username') {
      await this.grpcSdk.config.moduleExists('email');

      await this.grpcSdk.waitForExistence('email');

      this.emailModule = this.grpcSdk.emailProvider;
    }

    let errorMessage = null;
    await this.grpcSdk.config
      .moduleExists('sms')
      .catch((e: any) => (errorMessage = e.message));
    if (config.twofa.enabled && !errorMessage) {
      // maybe check if verify is enabled in sms module
      await this.grpcSdk.waitForExistence('sms');
      this.sms = this.grpcSdk.sms;
    } else {
      console.log('sms 2fa not active');
    }

    if (config.local.identifier === 'email') {
      this.registerTemplates();
    }
    this.initialized = true;
  }

  private registerTemplates() {
    this.grpcSdk.config
      .get('email')
      .then((emailConfig: any) => {
        const promises = Object.values(templates).map((template) => {
          return this.emailModule.registerTemplate(template);
        });
        return Promise.all(promises);
      })
      .then(() => {
        console.log('Email templates registered');
      })
      .catch(() => {
        console.error('Internal error while registering email templates');
      });
  }

  private async sendVerificationCode(to: string) {
    const verificationSid = await this.sms
      .sendVerificationCode(to)
      .catch(console.error);
    return verificationSid || '';
  }
}
