import { isEmpty, isNil } from 'lodash';
import { AuthUtils } from '../utils/auth';
import { TokenType } from '../constants/TokenType';
import { v4 as uuid } from 'uuid';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';
import ConduitGrpcSdk, {
  ConduitError,
  Email,
  GrpcError,
  ParsedRouterRequest,
  SMS,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import * as grpc from 'grpc';
import * as templates from '../templates';
import { ConfigController } from '../config/Config.controller';
import { AccessToken, RefreshToken, Token, User } from '../models';
import moment = require('moment');

export class LocalHandlers {
  private emailModule: Email;
  private sms: SMS;
  private initialized: boolean = false;
  private identifier: string = 'email';

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<Boolean> {
    const config = ConfigController.getInstance().config;
    let promise: Promise<void>;
    this.identifier = config.local.identifier;
    if (this.identifier !== 'username') {
      promise = this.grpcSdk.config.get('email').then((emailConfig: any) => {
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

  async register(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized)
      throw new GrpcError(grpc.status.NOT_FOUND, 'Requested resource not found');
    let { email, password } = call.request.params;

    if (email.indexOf('+') !== -1) {
      throw new GrpcError(
        grpc.status.INVALID_ARGUMENT,
        'Email contains unsupported characters'
      );
    }

    email = email.toLowerCase();

    let user: User | null = await User.getInstance().findOne({ email });
    if (!isNil(user))
      throw new GrpcError(grpc.status.ALREADY_EXISTS, 'User already exists');

    let hashedPassword = await AuthUtils.hashPassword(password);
    const isVerified = this.identifier === 'username';
    user = await User.getInstance().create({
      email,
      hashedPassword,
      isVerified,
    });

    this.grpcSdk.bus?.publish('authentication:register:user', JSON.stringify(user));

    const config = ConfigController.getInstance().config;

    let serverConfig = await this.grpcSdk.config.getServerConfig();
    let url = serverConfig.url;

    if (config.local.identifier === 'email' && config.local.sendVerificationEmail) {
      let verificationToken: Token = await Token.getInstance().create({
        type: TokenType.VERIFICATION_TOKEN,
        userId: user._id,
        token: uuid(),
      });
      let result = { verificationToken, hostUrl: url };
      const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
      await this.emailModule.sendEmail('EmailVerification', {
        email: user.email,
        sender: 'no-reply',
        variables: {
          link,
        },
      });
    }

    return { userId: user._id };
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized)
      throw new GrpcError(grpc.status.NOT_FOUND, 'Requested resource not found');
    let { email, password } = call.request.params;
    const context = call.request.context;

    if (isNil(context))
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'No headers provided');

    const clientId = context.clientId;

    if (email.indexOf('+') !== -1) {
      throw new GrpcError(
        grpc.status.INVALID_ARGUMENT,
        'Email contains unsupported characters'
      );
    }

    email = email.toLowerCase();

    const user: User | null = await User.getInstance().findOne(
      { email },
      '+hashedPassword'
    );
    if (isNil(user))
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Invalid login credentials');
    if (!user.active) throw new GrpcError(grpc.status.PERMISSION_DENIED, 'Inactive user');
    if (!user.hashedPassword)
      throw new GrpcError(
        grpc.status.PERMISSION_DENIED,
        'User does not use password authentication'
      );
    const passwordsMatch = await AuthUtils.checkPassword(password, user.hashedPassword);
    if (!passwordsMatch)
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Invalid login credentials');

    const config = ConfigController.getInstance().config;
    if (config.local.verificationRequired && !user.isVerified) {
      throw new GrpcError(
        grpc.status.PERMISSION_DENIED,
        'You must verify your account to login'
      );
    }

    if (user.hasTwoFA) {
      const verificationSid = await this.sendVerificationCode(user.phoneNumber!);
      if (verificationSid === '') {
        throw new GrpcError(grpc.status.INTERNAL, 'Could not send verification code');
      }

      await Token.getInstance()
        .deleteMany({
          userId: user._id,
          type: TokenType.TWO_FA_VERIFICATION_TOKEN,
        })
        .catch(console.error);

      await Token.getInstance().create({
        userId: user._id,
        type: TokenType.TWO_FA_VERIFICATION_TOKEN,
        token: verificationSid,
      });

      return {
        message: 'Verification code sent',
      };
    }

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: user._id,
        clientId,
      })
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

    return {
      userId: user._id.toString(),
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    };
  }

  async forgotPassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized || isNil(this.emailModule)) {
      throw new GrpcError(grpc.status.NOT_FOUND, 'Requested resource not found');
    }

    const { email } = call.request.params;
    const config = ConfigController.getInstance().config;

    const user: User | null = await User.getInstance().findOne({ email });

    if (isNil(user) || (config.local.verificationRequired && !user.isVerified))
      return { message: 'Ok' };

    let oldToken: Token | null = await Token.getInstance().findOne({
      type: TokenType.PASSWORD_RESET_TOKEN,
      userId: user._id,
    });
    if (!isNil(oldToken)) await Token.getInstance().deleteOne(oldToken);

    const passwordResetTokenDoc = await Token.getInstance().create({
      type: TokenType.PASSWORD_RESET_TOKEN,
      userId: user._id,
      token: uuid(),
    });

    let appUrl = config.local.forgot_password_redirect_uri;
    const link = `${appUrl}?reset_token=${passwordResetTokenDoc.token}`;
    await this.emailModule.sendEmail('ForgotPassword', {
      email: user.email,
      sender: 'no-reply',
      variables: {
        link,
      },
    });
    return { message: 'Ok' };
  }

  async resetPassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized || isNil(this.emailModule)) {
      throw new GrpcError(grpc.status.NOT_FOUND, 'Requested resource not found');
    }

    const {
      passwordResetToken: passwordResetTokenParam,
      password: newPassword,
    } = call.request.params;

    const passwordResetTokenDoc: Token | null = await Token.getInstance().findOne({
      type: TokenType.PASSWORD_RESET_TOKEN,
      token: passwordResetTokenParam,
    });
    if (isNil(passwordResetTokenDoc))
      throw new GrpcError(grpc.status.INVALID_ARGUMENT, 'Invalid parameters');

    const user: User | null = await User.getInstance().findOne(
      { _id: passwordResetTokenDoc.userId },
      '+hashedPassword'
    );
    if (isNil(user)) throw new GrpcError(grpc.status.NOT_FOUND, 'User not found');
    if (isNil(user.hashedPassword))
      throw new GrpcError(
        grpc.status.PERMISSION_DENIED,
        'User does not use password authentication'
      );

    const passwordsMatch = await AuthUtils.checkPassword(
      newPassword,
      user.hashedPassword!
    );
    if (passwordsMatch)
      throw new GrpcError(
        grpc.status.PERMISSION_DENIED,
        "Password can't be the same as the old one"
      );

    user.hashedPassword = await AuthUtils.hashPassword(newPassword);

    const userPromise: Promise<User | null> = User.getInstance().findByIdAndUpdate(
      user._id,
      user
    );
    const tokenPromise = Token.getInstance().deleteOne(passwordResetTokenDoc);

    await Promise.all(
      [userPromise, tokenPromise].concat(
        AuthUtils.deleteUserTokens(this.grpcSdk, {
          userId: user._id,
        })
      )
    );

    return { message: 'Password reset successful' };
  }

  async changePassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { oldPassword, newPassword } = call.request.params;
    const { user } = call.request.context;

    if (oldPassword === newPassword) {
      throw new GrpcError(
        grpc.status.INVALID_ARGUMENT,
        'The new password can not be the same as the old password'
      );
    }

    const dbUser: User | null = await User.getInstance().findOne(
      { _id: user._id },
      '+hashedPassword'
    );

    if (isNil(dbUser)) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'User does not exist');
    }
    if (isNil(dbUser.hashedPassword)) {
      throw new GrpcError(
        grpc.status.PERMISSION_DENIED,
        'User does not use password authentication'
      );
    }

    const passwordsMatch = await AuthUtils.checkPassword(
      oldPassword,
      dbUser.hashedPassword
    );
    if (!passwordsMatch) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Invalid password');
    }

    const hashedPassword = await AuthUtils.hashPassword(newPassword);

    if (dbUser.hasTwoFA) {
      const verificationSid = await this.sendVerificationCode(dbUser.phoneNumber!);
      if (verificationSid === '') {
        throw new GrpcError(grpc.status.INTERNAL, 'Could not send verification code');
      }

      await Token.getInstance()
        .deleteMany({
          userId: dbUser._id,
          type: TokenType.CHANGE_PASSWORD_TOKEN,
        })
        .catch(console.error);

      await Token.getInstance().create({
        userId: dbUser._id,
        type: TokenType.CHANGE_PASSWORD_TOKEN,
        token: verificationSid,
        data: {
          password: hashedPassword,
        },
      });

      return 'Verification code sent';
    }

    await User.getInstance().findByIdAndUpdate(dbUser._id, { hashedPassword });
    return 'Password changed successfully';
  }

  async verifyChangePassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { code } = call.request.params;
    const { user } = call.request.context;

    const token: Token | null = await Token.getInstance().findOne({
      userId: user._id,
      type: TokenType.CHANGE_PASSWORD_TOKEN,
    });

    if (isNil(token)) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Change password token not found');
    }

    const verified = await this.sms.verify(token.token, code);

    if (!verified) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Invalid code');
    }

    await Token.getInstance()
      .deleteMany({ userId: user._id, type: TokenType.CHANGE_PASSWORD_TOKEN })
      .catch(console.error);

    await User.getInstance().findByIdAndUpdate(user._id, {
      hashedPassword: token.data.password,
    });

    return 'Password changed successfully';
  }

  async verifyEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized)
      throw new GrpcError(grpc.status.NOT_FOUND, 'Requested resource not found');

    const verificationTokenParam = call.request.params.verificationToken;

    const config = ConfigController.getInstance().config;

    const verificationTokenDoc: Token | null = await Token.getInstance().findOne({
      type: TokenType.VERIFICATION_TOKEN,
      token: verificationTokenParam,
    });

    if (isNil(verificationTokenDoc)) {
      if (config.local.verification_redirect_uri) {
        return { redirect: config.local.verification_redirect_uri };
      } else {
        return { message: 'Email verified' };
      }
    }

    const user: User | null = await User.getInstance().findOne({
      _id: verificationTokenDoc.userId,
    });
    if (isNil(user)) throw new GrpcError(grpc.status.NOT_FOUND, 'User not found');

    user.isVerified = true;
    const userPromise: Promise<User | null> = User.getInstance().findByIdAndUpdate(
      user._id,
      user
    );
    const tokenPromise = Token.getInstance().deleteOne(verificationTokenDoc);

    await Promise.all([userPromise, tokenPromise]);

    this.grpcSdk.bus?.publish('authentication:verified:user', JSON.stringify(user));

    if (config.local.verification_redirect_uri) {
      return { redirect: config.local.verification_redirect_uri };
    }
    return { message: 'Email verified' };
  }

  async verify(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    if (isNil(context) || isEmpty(context))
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'No headers provided');

    const clientId = context.clientId;

    const { email, code } = call.request.params;

    const user: User | null = await User.getInstance().findOne({ email });

    if (isNil(user)) throw new GrpcError(grpc.status.UNAUTHENTICATED, 'User not found');

    const verificationRecord: Token | null = await Token.getInstance().findOne({
      userId: user._id,
      type: TokenType.TWO_FA_VERIFICATION_TOKEN,
    });
    if (isNil(verificationRecord))
      throw new GrpcError(
        grpc.status.INVALID_ARGUMENT,
        'No verification record for this user'
      );

    const verified = await this.sms.verify(verificationRecord.token, code);

    if (!verified) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'email and code do not match');
    }

    await Token.getInstance()
      .deleteMany({
        userId: user._id,
        type: TokenType.TWO_FA_VERIFICATION_TOKEN,
      })
      .catch(console.error);

    const config = ConfigController.getInstance().config;

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: user._id,
        clientId,
      })
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

    return {
      userId: user._id.toString(),
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    };
  }

  async enableTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { phoneNumber } = call.request.params;
    const context = call.request.context;

    if (isNil(context) || isNil(context.user)) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Unauthorized');
    }

    const verificationSid = await this.sendVerificationCode(phoneNumber);
    if (verificationSid === '') {
      throw new GrpcError(grpc.status.INTERNAL, 'Could not send verification code');
    }

    await Token.getInstance()
      .deleteMany({
        userId: context.user._id,
        type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      })
      .catch(console.error);

    await Token.getInstance().create({
      userId: context.user._id,
      type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      token: verificationSid,
      data: {
        phoneNumber,
      },
    });

    return {
      message: 'Verification code sent',
    };
  }

  async verifyPhoneNumber(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const { code } = call.request.params;

    if (isNil(context) || isEmpty(context)) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'No headers provided');
    }

    const verificationRecord: Token | null = await Token.getInstance().findOne({
      userId: context.user._id,
      type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
    });
    if (isNil(verificationRecord))
      throw new GrpcError(
        grpc.status.INVALID_ARGUMENT,
        'No verification record for this user'
      );

    const verified = await this.sms.verify(verificationRecord.token, code);

    if (!verified) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'email and code do not match');
    }

    await Token.getInstance()
      .deleteMany({
        userId: context.user._id,
        type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      })
      .catch(console.error);

    await User.getInstance().findByIdAndUpdate(context.user._id, {
      phoneNumber: verificationRecord.data.phoneNumber,
      hasTwoFA: true,
    });

    this.grpcSdk.bus?.publish(
      'authentication:enableTwofa:user',
      JSON.stringify({
        id: context.user._id,
        phoneNumber: verificationRecord.data.phoneNumber,
      })
    );

    return {
      message: 'twofa enabled',
    };
  }

  async disableTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    if (isNil(context) || isNil(context.user)) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Unauthorized');
    }

    await User.getInstance().findByIdAndUpdate(context.user._id, {
      hasTwoFA: false,
    });

    this.grpcSdk.bus?.publish(
      'authentication:disableTwofa:user',
      JSON.stringify({ id: context.user._id })
    );

    return {
      message: 'twofa disabled',
    };
  }

  private async initDbAndEmail() {
    const config = ConfigController.getInstance().config;

    if (config.local.identifier !== 'username') {
      await this.grpcSdk.config.moduleExists('email');

      await this.grpcSdk.waitForExistence('email');

      this.emailModule = this.grpcSdk.emailProvider!;
    }

    let errorMessage = null;
    await this.grpcSdk.config
      .moduleExists('sms')
      .catch((e: any) => (errorMessage = e.message));
    if (config.twofa.enabled && !errorMessage) {
      // maybe check if verify is enabled in sms module
      await this.grpcSdk.waitForExistence('sms');
      this.sms = this.grpcSdk.sms!;
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
    const verificationSid = await this.sms.sendVerificationCode(to).catch(console.error);
    return verificationSid || '';
  }
}
