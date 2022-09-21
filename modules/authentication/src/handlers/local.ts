import { isEmpty, isNil } from 'lodash';
import { AuthUtils } from '../utils/auth';
import { TokenType } from '../constants/TokenType';
import { v4 as uuid } from 'uuid';
import { Config } from '../config';
import ConduitGrpcSdk, {
  Email,
  GrpcError,
  ParsedRouterRequest,
  SMS,
  UnparsedRouterResponse,
  ConfigController,
  RoutingManager,
  ConduitRouteActions,
  ConduitString,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import * as templates from '../templates';
import { AccessToken, Token, TwoFactorSecret, User } from '../models';
import { status } from '@grpc/grpc-js';
import { Cookie } from '../interfaces/Cookie';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { TwoFactorAuth } from '../TwoFactorAuth';

export class LocalHandlers implements IAuthenticationStrategy {
  private emailModule: Email;
  private smsModule: SMS;
  private initialized: boolean = false;
  private clientValidation: boolean;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly sendVerificationEmail: boolean,
  ) {
    grpcSdk.config.get('router').then(config => {
      this.clientValidation = config.security.clientValidation;
    });
  }

  async declareRoutes(routingManager: RoutingManager, config: Config): Promise<void> {
    routingManager.route(
      {
        path: '/local/new',
        action: ConduitRouteActions.POST,
        description: 'Creates a new user using email/password.',
        bodyParams: {
          email: ConduitString.Required,
          password: ConduitString.Required,
        },
        middlewares: [],
      },
      new ConduitRouteReturnDefinition('RegisterResponse', User.name),
      this.register.bind(this),
    );

    routingManager.route(
      {
        path: '/local',
        action: ConduitRouteActions.POST,
        description: `Login endpoint that can be used to authenticate. 
              If 2FA is used for the user then instead of tokens 
              you will receive a message indicating the need for a token from the 2FA mechanism.`,
        bodyParams: {
          email: ConduitString.Required,
          password: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('LoginResponse', {
        userId: ConduitString.Optional,
        accessToken: ConduitString.Optional,
        message: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
        twoFaQrToken: ConduitString.Optional,
      }),
      this.authenticate.bind(this),
    );

    if (this.sendVerificationEmail) {
      routingManager.route(
        {
          path: '/forgot-password',
          action: ConduitRouteActions.POST,
          description: `Generates a password reset token and forwards a verification link to the user's email address.`,
          bodyParams: {
            email: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('ForgotPasswordResponse', 'String'),
        this.forgotPassword.bind(this),
      );

      routingManager.route(
        {
          path: '/reset-password',
          action: ConduitRouteActions.POST,
          description: `Used after the user clicks on the 'forgot password' link and
                        requires the token from the url and the new password.`,
          bodyParams: {
            passwordResetToken: ConduitString.Required,
            password: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('ResetPasswordResponse', 'String'),
        this.resetPassword.bind(this),
      );

      routingManager.route(
        {
          path: '/local/resend-verification',
          action: ConduitRouteActions.POST,
          description: `Used to resend email verification after new user is created.`,
          bodyParams: {
            email: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('ResendVerificationEmailResponse', 'String'),
        this.resendVerificationEmail.bind(this),
      );
    }

    routingManager.route(
      {
        path: '/local/change-password',
        action: ConduitRouteActions.POST,
        description: `Changes the user's password but requires the old password first.
                 If 2FA is enabled then a message will be returned asking for token input.`,
        bodyParams: {
          oldPassword: ConduitString.Required,
          newPassword: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChangePasswordResponse', 'String'),
      this.changePassword.bind(this),
    );

    routingManager.route(
      {
        path: '/local/change-email',
        action: ConduitRouteActions.POST,
        description: `Changes the user's email but requires password first.`,
        bodyParams: {
          newEmail: ConduitString.Required,
          password: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChangeEmailResponse', 'String'),
      this.changeEmail.bind(this),
    );

    routingManager.route(
      {
        path: '/hook/verify-email/:verificationToken',
        action: ConduitRouteActions.GET,
        description: `A webhook used to verify user email. This bypasses the need for client id/secret.`,
        urlParams: {
          verificationToken: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('VerifyEmailResponse', 'String'),
      this.verifyEmail.bind(this),
    );

    routingManager.route(
      {
        path: '/hook/verify-change-email/:verificationToken',
        action: ConduitRouteActions.GET,
        description: `A webhook used to verify an email address change. This bypasses the need for client id/secret.`,
        urlParams: {
          verificationToken: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('VerifyChangeEmailResponse', 'String'),
      this.verifyChangeEmail.bind(this),
    );

    if (config.twofa.enabled) {
      routingManager.route(
        {
          path: '/local/twofa',
          action: ConduitRouteActions.POST,
          description: `Verifies the 2FA token.`,
          bodyParams: {
            email: ConduitString.Required,
            code: ConduitString.Required,
            token: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('VerifyTwoFaResponse', {
          userId: ConduitString.Optional,
          accessToken: ConduitString.Optional,
          refreshToken: config.generateRefreshToken
            ? ConduitString.Required
            : ConduitString.Optional,
          message: ConduitString.Optional,
        }),
        this.verify2FA.bind(this),
      );

      routingManager.route(
        {
          path: '/local/enable-twofa',
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
          path: '/local/verify-qr-code',
          action: ConduitRouteActions.POST,
          description: `Verifies the code the user received from scanning the QR image`,
          middlewares: ['authMiddleware'],
          bodyParams: {
            code: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('VerifyQRCodeResponse', 'String'),
        this.verifyQrCode.bind(this),
      );

      routingManager.route(
        {
          path: '/local/verifyPhoneNumber',
          action: ConduitRouteActions.POST,
          description: `Verifies the phone number provided for the 2FA mechanism.`,
          middlewares: ['authMiddleware'],
          bodyParams: {
            code: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('VerifyPhoneNumberResponse', 'String'),
        this.verifyPhoneNumber.bind(this),
      );

      routingManager.route(
        {
          path: '/local/disable-twofa',
          action: ConduitRouteActions.UPDATE,
          description: `Disables the user's 2FA mechanism.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('DisableTwoFaResponse', 'String'),
        this.disableTwoFa.bind(this),
      );

      routingManager.route(
        {
          path: '/local/change-password/verify',
          action: ConduitRouteActions.POST,
          description: `Used to provide the 2FA token for password change.`,
          bodyParams: {
            code: ConduitString.Required,
          },
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('VerifyChangePasswordResponse', 'String'),
        this.verifyChangePassword.bind(this),
      );
    }
  }

  async validate(): Promise<boolean> {
    if (!this.initialized) {
      try {
        await this.initDbAndEmail();
        ConduitGrpcSdk.Logger.log('Local is active');
      } catch (err) {
        ConduitGrpcSdk.Logger.error((err as Error).message);
        ConduitGrpcSdk.Logger.log('Local not active');
        // De-initialize the provider if the config is now invalid
        this.initialized = false;
        throw err;
      }
    }
    return this.initialized;
  }

  async register(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const email = call.request.params.email.toLowerCase();
    const password = call.request.params.password;

    const invalidAddress = AuthUtils.invalidEmailAddress(email);
    if (invalidAddress) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid email address provided');
    }

    let user: User | null = await User.getInstance().findOne({ email });
    if (!isNil(user)) throw new GrpcError(status.ALREADY_EXISTS, 'User already exists');

    const hashedPassword = await AuthUtils.hashPassword(password);
    user = await User.getInstance().create({
      email,
      hashedPassword,
      isVerified: false,
    });

    this.grpcSdk.bus?.publish('authentication:register:user', JSON.stringify(user));

    const serverConfig = await this.grpcSdk.config.get('router');
    const url = serverConfig.hostUrl;
    if (this.sendVerificationEmail) {
      const verificationToken: Token = await Token.getInstance().create({
        type: TokenType.VERIFICATION_TOKEN,
        userId: user._id,
        token: uuid(),
      });
      const result = { verificationToken, hostUrl: url };
      const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
      await this.emailModule
        .sendEmail('EmailVerification', {
          email: user.email,
          sender: 'no-reply',
          variables: {
            link,
          },
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
    }
    delete user.hashedPassword;
    return { user };
  }

  private async _authenticateChecks(password: string, config: Config, user: User) {
    if (!user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
    if (!user.hashedPassword)
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not use password authentication',
      );
    const passwordsMatch = await AuthUtils.checkPassword(password, user.hashedPassword);
    if (!passwordsMatch)
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');

    if (config.local.verification.required && !user.isVerified) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'You must verify your account to login',
      );
    }
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    let email = call.request.params.email;
    const password = call.request.params.password;
    const context = call.request.context;
    if (isNil(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');

    const clientId = context.clientId;
    const invalidAddress = AuthUtils.invalidEmailAddress(email);
    if (invalidAddress) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid email address provided');
    }

    email = email.toLowerCase();
    const config = ConfigController.getInstance().config;

    const user: User | null = await User.getInstance().findOne(
      { email },
      '+hashedPassword',
    );
    if (isNil(user))
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');
    await this._authenticateChecks(password, config, user);

    if (user.hasTwoFA) {
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
            userId: user._id,
            type: TokenType.TWO_FA_VERIFICATION_TOKEN,
          })
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
          });

        await Token.getInstance().create({
          userId: user._id,
          type: TokenType.TWO_FA_VERIFICATION_TOKEN,
          token: verificationSid,
        });

        return {
          message: 'Verification code sent',
        };
      } else if (user.twoFaMethod === 'qrcode') {
        const secret = await TwoFactorSecret.getInstance().findOne({
          userId: user._id,
        });
        if (isNil(secret))
          throw new GrpcError(status.NOT_FOUND, 'Authentication unsuccessful');

        await Token.getInstance()
          .deleteMany({
            userId: user._id,
            type: TokenType.QR_TWO_FA_VERIFICATION_TOKEN,
          })
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
          });
        const qrVerificationToken = await Token.getInstance().create({
          userId: user._id,
          type: TokenType.QR_TWO_FA_VERIFICATION_TOKEN,
          token: uuid(),
        });
        return { message: 'OTP required', twoFaQrToken: qrVerificationToken.token };
      } else {
        throw new GrpcError(status.FAILED_PRECONDITION, '2FA method not specified');
      }
    }
    const clientConfig = config.clients;
    await AuthUtils.signInClientOperations(
      this.grpcSdk,
      clientConfig,
      user._id,
      clientId,
    );
    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: user._id,
        clientId: clientId,
        config,
      },
    );

    if (config.setCookies.enabled) {
      const cookieOptions = config.setCookies.options;
      if (cookieOptions.path === '') {
        delete cookieOptions.path;
      }
      const cookies: Cookie[] = [
        {
          name: 'accessToken',
          value: (accessToken as AccessToken).token,
          options: cookieOptions,
        },
      ];
      if (!isNil(refreshToken)) {
        cookies.push({
          name: 'refreshToken',
          value: refreshToken.token,
          options: cookieOptions,
        });
      }
      return {
        userId: user._id.toString(),
        setCookies: cookies,
      };
    }
    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');
    return {
      userId: user._id.toString(),
      accessToken: accessToken!.token,
      refreshToken: !isNil(refreshToken) ? refreshToken.token : undefined,
    };
  }

  async forgotPassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { email } = call.request.params;
    const config = ConfigController.getInstance().config;

    const user: User | null = await User.getInstance().findOne({ email });

    if (isNil(user) || (config.local.verification.required && !user.isVerified))
      return 'Ok';

    const oldToken: Token | null = await Token.getInstance().findOne({
      type: TokenType.PASSWORD_RESET_TOKEN,
      userId: user._id,
    });
    if (!isNil(oldToken)) await Token.getInstance().deleteOne(oldToken);

    const passwordResetTokenDoc = await Token.getInstance().create({
      type: TokenType.PASSWORD_RESET_TOKEN,
      userId: user._id,
      token: uuid(),
    });

    const appUrl = config.local.forgot_password_redirect_uri;
    const link = `${appUrl}?reset_token=${passwordResetTokenDoc.token}`;
    if (this.sendVerificationEmail) {
      await this.emailModule.sendEmail('ForgotPassword', {
        email: user.email,
        sender: 'no-reply',
        variables: {
          link,
        },
      });
    }
    return 'Ok';
  }

  async resetPassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { passwordResetToken: passwordResetTokenParam, password: newPassword } =
      call.request.params;

    const passwordResetTokenDoc: Token | null = await Token.getInstance().findOne({
      type: TokenType.PASSWORD_RESET_TOKEN,
      token: passwordResetTokenParam,
    });
    if (isNil(passwordResetTokenDoc))
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid parameters');

    const user: User | null = await User.getInstance().findOne(
      { _id: passwordResetTokenDoc.userId },
      '+hashedPassword',
    );
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    if (isNil(user.hashedPassword))
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not use password authentication',
      );

    const passwordsMatch = await AuthUtils.checkPassword(
      newPassword,
      user.hashedPassword!,
    );
    if (passwordsMatch)
      throw new GrpcError(
        status.PERMISSION_DENIED,
        "Password can't be the same as the old one",
      );

    user.hashedPassword = await AuthUtils.hashPassword(newPassword);

    const userPromise: Promise<User | null> = User.getInstance().findByIdAndUpdate(
      user._id,
      user,
    );
    const tokenPromise = Token.getInstance().deleteOne(passwordResetTokenDoc);

    await Promise.all(
      [userPromise, tokenPromise].concat(
        AuthUtils.deleteUserTokens(this.grpcSdk, {
          userId: user._id,
        }),
      ),
    );

    return 'Password reset successful';
  }

  async changePassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { oldPassword, newPassword } = call.request.params;
    const { user } = call.request.context;

    if (oldPassword === newPassword) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'The new password can not be the same as the old password',
      );
    }

    const dbUser = await AuthUtils.dbUserChecks(user, oldPassword).catch(error => {
      throw error;
    });

    const hashedPassword = await AuthUtils.hashPassword(newPassword);

    if (dbUser.hasTwoFA) {
      await Token.getInstance()
        .deleteMany({
          userId: dbUser._id,
          type: TokenType.CHANGE_PASSWORD_TOKEN,
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });

      if (user.twoFaMethod === 'phone') {
        const verificationSid = await AuthUtils.sendVerificationCode(
          this.smsModule,
          dbUser.phoneNumber!,
        );
        if (verificationSid === '') {
          throw new GrpcError(status.INTERNAL, 'Could not send verification code');
        }
        await Token.getInstance().create({
          userId: dbUser._id,
          type: TokenType.CHANGE_PASSWORD_TOKEN,
          token: verificationSid,
          data: {
            password: hashedPassword,
          },
        });
        return 'Verification code sent';
      } else if (user.twoFaMethod == 'qrcode') {
        const secret = await TwoFactorSecret.getInstance().findOne({
          userId: user._id,
        });
        if (isNil(secret))
          throw new GrpcError(status.NOT_FOUND, 'Authentication unsuccessful');

        await Token.getInstance().create({
          userId: dbUser._id,
          type: TokenType.CHANGE_PASSWORD_TOKEN,
          token: uuid(),
          data: {
            password: hashedPassword,
          },
        });
        return 'OTP required';
      } else {
        throw new GrpcError(status.FAILED_PRECONDITION, '2FA method not specified');
      }
    }

    await User.getInstance().findByIdAndUpdate(dbUser._id, { hashedPassword });
    return 'Password changed successfully';
  }

  async changeEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { newEmail, password } = call.request.params;
    const { user } = call.request.context;
    const config = ConfigController.getInstance().config;

    const validation = await this.validate();
    if (!validation) {
      throw new GrpcError(status.INTERNAL, 'Cannot use verification at this time');
    }
    if (user.email === newEmail) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'The new email can not be the same as the old email',
      );
    }
    const invalidAddress = AuthUtils.invalidEmailAddress(newEmail);
    if (invalidAddress) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid email address provided');
    }
    const dupEmailUser = await User.getInstance().findOne({ email: newEmail });
    if (dupEmailUser) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Email address already taken');
    }
    const dbUser = await AuthUtils.dbUserChecks(user, password).catch(error => {
      throw error;
    });

    if (config.local.verification.required) {
      const verificationToken: Token | void = await AuthUtils.createToken(
        dbUser._id,
        { email: newEmail },
        TokenType.CHANGE_EMAIL_TOKEN,
      ).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
      if (this.sendVerificationEmail) {
        const serverConfig = await this.grpcSdk.config.get('router');
        const url = serverConfig.hostUrl;
        const result = { verificationToken, hostUrl: url };
        const link = `${result.hostUrl}/hook/authentication/verify-change-email/${
          result.verificationToken!.token
        }`;
        await this.emailModule
          .sendEmail('ChangeEmailVerification', {
            email: newEmail,
            sender: 'no-reply',
            variables: {
              link,
            },
          })
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
          });
        return 'Verification code sent';
      }
      return 'Verification required';
    }
    await User.getInstance().findByIdAndUpdate(dbUser._id, { email: newEmail });
    return 'Email changed successfully';
  }

  async verifyChangePassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { code } = call.request.params;
    const { user } = call.request.context;

    const token: Token | null = await Token.getInstance().findOne({
      userId: user._id,
      type: TokenType.CHANGE_PASSWORD_TOKEN,
    });
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Change password token does not exist');
    }

    if (user.twoFaMethod === 'phone') {
      const verified = await this.smsModule.verify(token.token, code);
      if (!verified.verified) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Invalid code');
      }
    } else if (user.twoFaMethod === 'qrcode') {
      const secret = await TwoFactorSecret.getInstance().findOne({
        userId: user._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');

      const verification = TwoFactorAuth.verifyToken(secret.secret, code);
      if (isNil(verification))
        throw new GrpcError(status.UNAUTHENTICATED, 'Verification unsuccessful');
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, '2FA method not specified');
    }

    await Token.getInstance()
      .deleteMany({ userId: user._id, type: TokenType.CHANGE_PASSWORD_TOKEN })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    await User.getInstance().findByIdAndUpdate(user._id, {
      hashedPassword: token.data.password,
    });

    return 'Password changed successfully';
  }

  async verifyEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const verificationTokenParam = call.request.params.verificationToken;

    const config = ConfigController.getInstance().config;

    const verificationTokenDoc: Token | null = await Token.getInstance().findOne({
      type: TokenType.VERIFICATION_TOKEN,
      token: verificationTokenParam,
    });
    if (isNil(verificationTokenDoc)) {
      const redisToken = await this.grpcSdk.state!.getKey(
        'verifiedToken_' + verificationTokenParam,
      );
      if (redisToken) {
        if (config.local.verification.redirect_uri)
          return { redirect: config.verification.redirect_uri };

        return 'Email verified';
      } else {
        throw new GrpcError(status.NOT_FOUND, 'Verification token not found');
      }
    }

    const user: User | null = await User.getInstance().findOne({
      _id: verificationTokenDoc.userId,
    });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');

    user.isVerified = true;
    const userPromise: Promise<User | null> = User.getInstance().findByIdAndUpdate(
      user._id,
      user,
    );
    const tokenPromise = Token.getInstance().deleteOne(verificationTokenDoc);
    await this.grpcSdk.state!.setKey(
      'verifiedToken_' + verificationTokenDoc.token,
      '{}',
      10 * 60 * 60 * 1000,
    );

    await Promise.all([userPromise, tokenPromise]);

    this.grpcSdk.bus?.publish('authentication:verified:user', JSON.stringify(user));

    if (config.local.verification.redirect_uri) {
      return { redirect: config.local.verification.redirect_uri };
    }
    return 'Email verified';
  }

  async verifyChangeEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { verificationToken } = call.request.params.verificationToken;
    const config = ConfigController.getInstance().config;
    const token: Token | null = await Token.getInstance().findOne({
      type: TokenType.CHANGE_EMAIL_TOKEN,
      token: verificationToken,
    });
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Change email token does not exist');
    }
    const user: User | null = await User.getInstance().findOne({
      _id: token.userId,
    });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    await Token.getInstance()
      .deleteMany({ userId: token.userId, type: TokenType.CHANGE_EMAIL_TOKEN })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    await User.getInstance().findByIdAndUpdate(token.userId as string, {
      email: token.data.email,
    });
    if (config.local.verification.redirect_uri) {
      return { redirect: config.local.verification.redirect_uri };
    }
    return 'Email changed successfully';
  }

  async resendVerificationEmail(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    let { email } = call.request.params;
    const invalidAddress = AuthUtils.invalidEmailAddress(email);
    if (invalidAddress) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid email address provided');
    }
    email = email.toLowerCase();
    const user: User | null = await User.getInstance().findOne({
      email: email,
    });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    if (user.isVerified)
      throw new GrpcError(status.FAILED_PRECONDITION, 'User already verified');

    let verificationToken: Token | null = await Token.getInstance().findOne({
      type: TokenType.VERIFICATION_TOKEN,
      userId: user._id,
    });
    if (!isNil(verificationToken)) {
      const diffInMilliSec = Math.abs(
        new Date(verificationToken.createdAt).getTime() - Date.now(),
      );
      if (diffInMilliSec < 600000) {
        const remainTime = Math.ceil((600000 - diffInMilliSec) / 60000);
        throw new GrpcError(
          status.RESOURCE_EXHAUSTED,
          'Verification code not sent. You have to wait ' +
            remainTime +
            ' minutes to try again',
        );
      }
      await Token.getInstance().deleteMany({
        userId: user._id,
        type: TokenType.VERIFICATION_TOKEN,
      });
    }

    verificationToken = await Token.getInstance().create({
      userId: user._id,
      type: TokenType.VERIFICATION_TOKEN,
      token: uuid(),
      data: {
        email: email,
      },
    });

    const serverConfig = await this.grpcSdk.config.get('router');
    const result = { token: verificationToken.token, hostUrl: serverConfig.hostUrl };
    const link = `${result.hostUrl}/hook/authentication/verify-email/${result.token}`;
    await this.emailModule.sendEmail('EmailVerification', {
      email: email,
      sender: 'no-reply',
      variables: {
        link,
      },
    });
    return 'Verification code sent';
  }

  async verify2FA(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;

    if (isNil(context) || isEmpty(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    const clientId = context.clientId;
    const { email, code, token } = call.request.params;

    const user: User | null = await User.getInstance().findOne({ email });
    if (isNil(user)) throw new GrpcError(status.UNAUTHENTICATED, 'User not found');

    if (user.twoFaMethod == 'phone') {
      return await AuthUtils.verifyCode(
        this.grpcSdk,
        clientId,
        user,
        TokenType.TWO_FA_VERIFICATION_TOKEN,
        code,
      );
    } else if (user.twoFaMethod == 'qrcode') {
      if (!token) throw new GrpcError(status.UNAUTHENTICATED, 'No token provided');
      return await TwoFactorAuth.verifyCode(this.grpcSdk, clientId, user, token, code);
    } else {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Method not valid');
    }
  }

  async enableTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { method, phoneNumber } = call.request.params;
    const context = call.request.context;

    if (isNil(context) || isNil(context.user)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
    }
    if (context.user.hasTwoFA) {
      return '2FA already enabled';
    }

    if (method === 'phone') {
      const verificationSid = await AuthUtils.sendVerificationCode(
        this.smsModule,
        phoneNumber,
      );
      if (verificationSid === '') {
        throw new GrpcError(status.INTERNAL, 'Could not send verification code');
      }

      await AuthUtils.createToken(
        context.user._id,
        { data: phoneNumber },
        TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      ).catch(e => ConduitGrpcSdk.Logger.error(e));

      await User.getInstance().findByIdAndUpdate(context.user._id, {
        twoFaMethod: 'phone',
      });

      return 'Verification code sent';
    } else if (method === 'qrcode') {
      const secret = TwoFactorAuth.generateSecret({
        //to do: add logic for app name insertion
        name: 'Conduit',
        account: context.user.email,
      });

      await TwoFactorSecret.getInstance().deleteMany({
        userId: context.user._id,
      });

      await TwoFactorSecret.getInstance().create({
        userId: context.user._id,
        secret: secret.secret,
        uri: secret.uri,
        qr: secret.qr,
      });

      await User.getInstance().findByIdAndUpdate(context.user._id, {
        twoFaMethod: 'qrcode',
      });
      return secret.qr.toString();
    }
    throw new GrpcError(status.INVALID_ARGUMENT, 'Method not valid');
  }

  async verifyQrCode(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const { code } = call.request.params;

    if (isNil(context) || isEmpty(context)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'User unauthenticated');
    }
    if (context.user.hasTwoFA) {
      return '2FA already enabled';
    }

    const secret = await TwoFactorSecret.getInstance().findOne({
      userId: context.user._id,
    });
    if (isNil(secret)) throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');

    const verification = TwoFactorAuth.verifyToken(secret.secret, code);
    if (isNil(verification)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Verification unsuccessful');
    }

    await User.getInstance().findByIdAndUpdate(context.user._id, {
      hasTwoFA: true,
    });

    this.grpcSdk.bus?.publish(
      'authentication:enableTwofa:user',
      JSON.stringify({ id: context.user._id }),
    );
    return '2FA enabled';
  }

  async verifyPhoneNumber(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const { code } = call.request.params;

    if (isNil(context) || isEmpty(context)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    }

    const verificationRecord: Token | null = await Token.getInstance().findOne({
      userId: context.user._id,
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
        userId: context.user._id,
        type: TokenType.VERIFY_PHONE_NUMBER_TOKEN,
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    await User.getInstance().findByIdAndUpdate(context.user._id, {
      phoneNumber: verificationRecord.data.phoneNumber,
      hasTwoFA: true,
    });

    this.grpcSdk.bus?.publish(
      'authentication:enableTwofa:user',
      JSON.stringify({
        id: context.user._id,
        phoneNumber: verificationRecord.data.phoneNumber,
      }),
    );

    return 'twofa enabled';
  }

  async disableTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;

    if (isNil(context) || isNil(context.user)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
    }

    await User.getInstance().findByIdAndUpdate(context.user._id, {
      hasTwoFA: false,
    });

    this.grpcSdk.bus?.publish(
      'authentication:disableTwofa:user',
      JSON.stringify({ id: context.user._id }),
    );

    return 'twofa disabled';
  }

  private async initDbAndEmail() {
    const config = ConfigController.getInstance().config;

    if (this.sendVerificationEmail) {
      await this.grpcSdk.config.moduleExists('email');
      this.emailModule = this.grpcSdk.emailProvider!;
    }

    let errorMessage = null;
    await this.grpcSdk.config.moduleExists('sms').catch(e => (errorMessage = e.message));
    if (config.twofa.enabled && !errorMessage) {
      // maybe check if verify is enabled in sms module
      await this.grpcSdk.waitForExistence('sms');
      this.smsModule = this.grpcSdk.sms!;
    } else {
      ConduitGrpcSdk.Logger.log('sms 2fa not active');
    }

    if (config.phoneAuthentication.enabled && !errorMessage) {
      // maybe check if verify is enabled in sms module
      await this.grpcSdk.waitForExistence('sms');
      this.smsModule = this.grpcSdk.sms!;
    } else {
      ConduitGrpcSdk.Logger.log('phone authentication not active');
    }

    if (this.sendVerificationEmail) {
      this.registerTemplates();
    }
    this.initialized = true;
  }

  private registerTemplates() {
    const promises = Object.values(templates).map(template => {
      return this.emailModule.registerTemplate(template);
    });
    Promise.all(promises)
      .then(() => {
        ConduitGrpcSdk.Logger.log('Email templates registered');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Internal error while registering email templates');
      });
  }
}
