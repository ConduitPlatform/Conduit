import { isNil } from 'lodash';
import { AuthUtils } from '../utils';
import { TokenType } from '../constants/TokenType';
import { v4 as uuid } from 'uuid';
import { Config } from '../config';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  Email,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import * as templates from '../templates';
import { Token, User } from '../models';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { TokenProvider } from './tokenProvider';
import { TeamsHandler } from './team';

export class LocalHandlers implements IAuthenticationStrategy {
  private emailModule: Email;
  private initialized: boolean = false;
  private clientValidation: boolean;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    grpcSdk.config.get('router').then(config => {
      this.clientValidation = config.security.clientValidation;
    });
  }

  async declareRoutes(routingManager: RoutingManager): Promise<void> {
    const captchaConfig = ConfigController.getInstance().config.captcha;
    routingManager.route(
      {
        path: '/local/new',
        action: ConduitRouteActions.POST,
        description: 'Creates a new user using email/password.',
        bodyParams: {
          email: ConduitString.Required,
          password: ConduitString.Required,
          invitationToken: ConduitString.Optional,
          captchaToken: ConduitString.Optional,
        },
        middlewares:
          captchaConfig.enabled && captchaConfig.routes.register
            ? ['captchaMiddleware']
            : undefined,
      },
      new ConduitRouteReturnDefinition('RegisterResponse', User.name),
      this.register.bind(this),
    );

    routingManager.route(
      {
        path: '/local',
        action: ConduitRouteActions.POST,
        description: `Login endpoint that can be used to authenticate.
         Tokens are returned according to configuration.`,
        bodyParams: {
          email: ConduitString.Required,
          password: ConduitString.Required,
          captchaToken: ConduitString.Optional,
        },
        middlewares:
          captchaConfig.enabled && captchaConfig.routes.login
            ? ['captchaMiddleware']
            : undefined,
      },
      new ConduitRouteReturnDefinition('LoginResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authenticate.bind(this),
    );
    const config = ConfigController.getInstance().config;
    if (config.local.verification.send_email && this.grpcSdk.isAvailable('email')) {
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
        description: `Changes the user's email (requires sudo access).`,
        bodyParams: {
          newEmail: ConduitString.Required,
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
  }

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    if (config.local.enabled) {
      try {
        await this.initDbAndEmail();
        ConduitGrpcSdk.Logger.log('Local authentication is available');
      } catch (err) {
        ConduitGrpcSdk.Logger.error((err as Error).message);
        ConduitGrpcSdk.Logger.log('Local authentication not available');
        // De-initialize the provider if the config is now invalid
        this.initialized = false;
        throw err;
      }
    } else {
      ConduitGrpcSdk.Logger.log('Local authentication not available');
      this.initialized = false;
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
    if (
      ConfigController.getInstance().config.local.verification.send_email &&
      this.grpcSdk.isAvailable('email')
    ) {
      const verificationToken: Token = await Token.getInstance().create({
        type: TokenType.VERIFICATION_TOKEN,
        user: user._id,
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

    if (call.request.params.invitationToken) {
      await TeamsHandler.getInstance()
        .addUserToTeam(user, call.request.params.invitationToken)
        .catch(err => {
          ConduitGrpcSdk.Logger.error(err);
        });
    } else {
      await TeamsHandler.getInstance()
        .addUserToDefault(user)
        .catch(err => {
          ConduitGrpcSdk.Logger.error(err);
        });
    }
    delete user.hashedPassword;
    return { user };
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
    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId,
      config,
    });
  }

  async forgotPassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { email } = call.request.params;
    const config = ConfigController.getInstance().config;

    const user: User | null = await User.getInstance().findOne({ email });

    if (isNil(user) || (config.local.verification.required && !user.isVerified))
      return 'Ok';

    const oldToken: Token | null = await Token.getInstance().findOne({
      type: TokenType.PASSWORD_RESET_TOKEN,
      user: user._id,
    });
    if (!isNil(oldToken) && AuthUtils.checkResendThreshold(oldToken)) {
      await Token.getInstance().deleteOne(oldToken);
    }

    const passwordResetTokenDoc = await Token.getInstance().create({
      type: TokenType.PASSWORD_RESET_TOKEN,
      user: user._id,
      token: uuid(),
    });

    const appUrl = config.local.forgot_password_redirect_uri;
    const link = `${appUrl}?reset_token=${passwordResetTokenDoc.token}`;
    if (config.local.verification.send_email && this.grpcSdk.isAvailable('email')) {
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
      { _id: passwordResetTokenDoc.user as string },
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

    await User.getInstance().findByIdAndUpdate(user._id, user);
    await Token.getInstance().deleteOne(passwordResetTokenDoc);

    await TokenProvider.getInstance().deleteUserTokens({
      user: user._id,
    });

    return 'Password reset successful';
  }

  async changePassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!call.request.context.jwtPayload.sudo) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
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

    await User.getInstance().findByIdAndUpdate(dbUser._id, { hashedPassword });
    return 'Password changed successfully';
  }

  async changeEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!call.request.context.jwtPayload.sudo) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
    const { newEmail } = call.request.params;
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

    if (config.local.verification.required) {
      const verificationToken: Token | void = await AuthUtils.createToken(
        user._id,
        { email: newEmail },
        TokenType.CHANGE_EMAIL_TOKEN,
      ).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
      if (config.local.verification.send_email && this.grpcSdk.isAvailable('email')) {
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
    await User.getInstance().findByIdAndUpdate(user._id, { email: newEmail });
    return 'Email changed successfully';
  }

  async verifyEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const verificationTokenParam = call.request.params.verificationToken;

    const config = ConfigController.getInstance().config;

    const verificationTokenDoc: Token | null = await Token.getInstance().findOne(
      {
        type: TokenType.VERIFICATION_TOKEN,
        token: verificationTokenParam,
      },
      undefined,
      ['user'],
    );
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

    const user: User = verificationTokenDoc.user as User;
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
    const token: Token | null = await Token.getInstance().findOne(
      {
        type: TokenType.CHANGE_EMAIL_TOKEN,
        token: verificationToken,
      },
      undefined,
      ['user'],
    );
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Change email token does not exist');
    }
    const user: User = token.user as User;
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    await Token.getInstance()
      .deleteMany({ user: user._id, type: TokenType.CHANGE_EMAIL_TOKEN })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    await User.getInstance().findByIdAndUpdate(user._id as string, {
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
      user: user._id,
    });
    if (!isNil(verificationToken) && AuthUtils.checkResendThreshold(verificationToken)) {
      await Token.getInstance().deleteMany({
        user: user._id,
        type: TokenType.VERIFICATION_TOKEN,
      });
    }

    verificationToken = await Token.getInstance().create({
      user: user._id,
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

  private async initDbAndEmail() {
    const config = ConfigController.getInstance().config;

    if (config.local.verification.send_email && this.grpcSdk.isAvailable('email')) {
      this.emailModule = this.grpcSdk.emailProvider!;
    }

    if (config.local.verification.send_email && this.grpcSdk.isAvailable('email')) {
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
