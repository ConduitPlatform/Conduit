import { isNil } from 'lodash-es';
import { AuthUtils } from '../utils/index.js';
import { TokenType } from '../constants/index.js';
import { v4 as uuid } from 'uuid';
import { Config } from '../config/index.js';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  Email,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import * as templates from '../templates/index.js';
import { Token, User } from '../models/index.js';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import { TeamsHandler } from './team.js';
import {
  ConduitJson,
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { createHash } from 'crypto';
import { merge } from 'lodash-es';

export class LocalHandlers implements IAuthenticationStrategy {
  private emailModule: Email;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async declareRoutes(routingManager: RoutingManager): Promise<void> {
    const config = ConfigController.getInstance().config;
    const captchaConfig = config.captcha;

    const localRouteMiddleware = ['authMiddleware?', 'checkAnonymousMiddleware'];
    if (captchaConfig.enabled && captchaConfig.routes.register) {
      localRouteMiddleware.unshift('captchaMiddleware');
    }

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
          redirectUri: ConduitString.Optional,
          userData: ConduitJson.Optional,
        },
        middlewares: localRouteMiddleware,
      },
      new ConduitRouteReturnDefinition('RegisterResponse', User.name),
      this.register.bind(this),
    );
    if (config.anonymousUsers.enabled && config.teams.allowRegistrationWithoutInvite) {
      routingManager.route(
        {
          path: '/local/new/anonymous',
          action: ConduitRouteActions.POST,
          bodyParams: {
            userData: ConduitJson.Optional,
          },
          description: `Creates a new anonymous user.`,
        },
        new ConduitRouteReturnDefinition('LoginResponse', {
          accessToken: ConduitString.Optional,
          refreshToken: ConduitString.Optional,
        }),
        this.anonymousRegister.bind(this),
      );
    }

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

    if (this.grpcSdk.isAvailable('email')) {
      routingManager.route(
        {
          path: '/forgot-password',
          action: ConduitRouteActions.POST,
          description: `Generates a password reset token and forwards a verification link to the user's email address.`,
          bodyParams: {
            email: ConduitString.Required,
            redirectUri: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('ForgotPasswordResponse', 'String'),
        this.forgotPassword.bind(this),
      );
    }
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
    if (config.local.verification.send_email && this.grpcSdk.isAvailable('email')) {
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
        description: `Changes the user's password (requires sudo access).`,
        bodyParams: {
          newPassword: ConduitString.Required,
        },
        middlewares: ['authMiddleware', 'denyAnonymousMiddleware'],
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
          redirectUri: ConduitString.Optional,
        },
        middlewares: ['authMiddleware', 'denyAnonymousMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChangeEmailResponse', 'String'),
      this.changeEmail.bind(this),
    );

    if (config.local.verification.method === 'code') {
      routingManager.route(
        {
          path: '/local/verify-email',
          action: ConduitRouteActions.POST,
          description: `Verifies user email with code.`,
          bodyParams: {
            email: ConduitString.Required,
            code: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('VerifyEmailWithCode', 'String'),
        this.verifyEmailWithCode.bind(this),
      );
    }

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

  async register(
    call: ParsedRouterRequest,
    callback: (response: UnparsedRouterResponse) => void,
  ) {
    const email = call.request.params.email.toLowerCase();
    const { password, invitationToken, redirectUri, userData } = call.request.params;

    let userInvitationExtensionData: any;

    const config = ConfigController.getInstance().config;
    const teams = config.teams;
    if (
      teams.enabled &&
      !teams.allowRegistrationWithoutInvite &&
      isNil(invitationToken)
    ) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Registration requires invitation');
    }
    let isVerified = false;
    if (teams.enabled && invitationToken) {
      const valid = await TeamsHandler.getInstance().inviteValidation(
        invitationToken,
        email,
      );
      if (!valid) {
        throw new GrpcError(status.PERMISSION_DENIED, 'Invalid invitation token');
      }
      isVerified = await TeamsHandler.getInstance().verifyUserViaInvitation(
        invitationToken,
        email,
      );
      userInvitationExtensionData = await Token.getInstance()
        .findOne({
          tokenType: TokenType.TEAM_INVITE_TOKEN,
          token: invitationToken,
        })
        .then(token => {
          if (token?.data?.userData) {
            AuthUtils.checkUserData(token.data.userData);
          }
          return token?.data?.userData;
        });
    }
    const invalidAddress = AuthUtils.invalidEmailAddress(email);
    if (invalidAddress) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid email address provided');
    }

    let user: User | null = await User.getInstance().findOne({ email });
    if (!isNil(user)) throw new GrpcError(status.ALREADY_EXISTS, 'User already exists');
    if (userData) {
      AuthUtils.checkUserData(userData);
    }

    const hashedPassword = await AuthUtils.hashPassword(password);
    const { anonymousUser } = call.request.context;
    if (anonymousUser) {
      user = (await User.getInstance().findByIdAndUpdate(anonymousUser._id, {
        email,
        hashedPassword,
        isAnonymous: false,
        isVerified,
      })) as User;
    } else {
      user = await User.getInstance().create({
        email,
        hashedPassword,
        isVerified,
        ...merge(userInvitationExtensionData ?? {}, userData ?? {}),
      });
    }
    delete user.hashedPassword;

    this.grpcSdk.bus?.publish('authentication:register:user', JSON.stringify(user));
    callback({ user });

    if (
      config.local.verification.send_email &&
      this.grpcSdk.isAvailable('email') &&
      !isVerified
    ) {
      await this.handleEmailVerification(user, redirectUri).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    }

    if (invitationToken) {
      await TeamsHandler.getInstance()
        .addUserToTeam(user, invitationToken)
        .catch(err => {
          ConduitGrpcSdk.Logger.error(err);
        });
    } else if (!anonymousUser) {
      await TeamsHandler.getInstance()
        .addUserToDefault(user)
        .catch(err => {
          ConduitGrpcSdk.Logger.error(err);
        });
    }
  }

  async anonymousRegister(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const email = `${uuid()}@anonymous.com`;
    const { userData } = call.request.params;
    if (userData) {
      AuthUtils.checkUserData(userData);
    }
    const anonymousUser = await User.getInstance().create({
      email,
      isAnonymous: true,
      isVerified: false,
      ...userData,
    });
    const context = call.request.context;
    const config = ConfigController.getInstance().config;
    await TeamsHandler.getInstance()
      .addUserToDefault(anonymousUser)
      .catch(err => {
        ConduitGrpcSdk.Logger.error(err);
      });
    return TokenProvider.getInstance().provideUserTokens({
      user: anonymousUser,
      clientId: context.clientId,
      config,
      isRefresh: false,
    });
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const email = call.request.params.email.toLowerCase();
    const password = call.request.params.password;
    const context = call.request.context;
    if (isNil(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');

    const clientId = context.clientId;
    const invalidAddress = AuthUtils.invalidEmailAddress(email);
    if (invalidAddress) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid email address provided');
    }

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
    const email = call.request.params.email.toLowerCase();
    const config = ConfigController.getInstance().config;
    const redirectUri =
      AuthUtils.validateRedirectUri(call.request.bodyParams.redirectUri) ??
      config.local.forgot_password_redirect_uri;

    const user: User | null = await User.getInstance().findOne(
      { email },
      '+hashedPassword',
    );

    if (isNil(user))
      return 'If the email address is valid, a password reset link will be sent to it.';
    if (user.isAnonymous) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Anonymous user');
    }
    if (isNil(user.hashedPassword))
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not use password authentication',
      );

    const oldToken: Token | null = await Token.getInstance().findOne({
      tokenType: TokenType.PASSWORD_RESET_TOKEN,
      user: user._id,
    });
    if (!isNil(oldToken) && AuthUtils.checkResendThreshold(oldToken)) {
      await Token.getInstance().deleteOne(oldToken);
    }

    const passwordResetTokenDoc = await Token.getInstance().create({
      tokenType: TokenType.PASSWORD_RESET_TOKEN,
      user: user._id,
      token: uuid(),
    });

    const link = `${redirectUri}?reset_token=${passwordResetTokenDoc.token}`;
    if (this.grpcSdk.isAvailable('email')) {
      await this.emailModule
        .sendEmail('ForgotPassword', {
          email: user.email,
          variables: {
            link,
          },
        })
        .catch(() => {
          throw new GrpcError(
            status.INTERNAL,
            'There was an error sending the email. Please try again later.',
          );
        });
    } else {
      throw new GrpcError(
        status.INTERNAL,
        'There was an error sending the email. Please try again later.',
      );
    }
    return 'If the email address is valid, a password reset link will be sent to it.';
  }

  async resetPassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { passwordResetToken: passwordResetTokenParam, password: newPassword } =
      call.request.params;

    const passwordResetTokenDoc: Token | null = await Token.getInstance().findOne({
      tokenType: TokenType.PASSWORD_RESET_TOKEN,
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
      user.hashedPassword,
    );
    if (passwordsMatch)
      throw new GrpcError(
        status.PERMISSION_DENIED,
        "Password can't be the same as the old one",
      );

    const hashedPassword = await AuthUtils.hashPassword(newPassword);

    await User.getInstance().findByIdAndUpdate(user._id, { hashedPassword });
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
    const { user } = call.request.context;
    const { newPassword } = call.request.bodyParams;
    const hashedPassword = await AuthUtils.hashPassword(newPassword);
    await User.getInstance().findByIdAndUpdate(user._id, { hashedPassword });
    return 'Password changed successfully';
  }

  async changeEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!call.request.context.jwtPayload.sudo) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
    const newEmail = call.request.params.newEmail.toLowerCase();
    const { user } = call.request.context;
    const config = ConfigController.getInstance().config;
    const redirectUri =
      AuthUtils.validateRedirectUri(call.request.bodyParams.redirectUri) ??
      config.local.verification.redirect_uri;

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
        { email: newEmail, customRedirectUri: redirectUri },
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
    const config = ConfigController.getInstance().config;
    const verificationTokenParam = call.request.params.verificationToken;
    const verificationTokenDoc: Token | null = await Token.getInstance().findOne(
      {
        tokenType: TokenType.VERIFICATION_TOKEN,
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
        const redirectUri = AuthUtils.validateRedirectUri(
          JSON.parse(redisToken).customRedirectUri,
        );
        return { redirect: redirectUri ?? config.local.verification.redirect_uri };
      } else {
        throw new GrpcError(status.NOT_FOUND, 'Verification token not found');
      }
    }

    const user: User = verificationTokenDoc.user as User;
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    const redirectUri = AuthUtils.validateRedirectUri(
      verificationTokenDoc.data ? verificationTokenDoc.data.customRedirectUri : undefined,
    );
    const userPromise: Promise<User | null> = User.getInstance().findByIdAndUpdate(
      user._id,
      { isVerified: true },
    );
    const tokenPromise = Token.getInstance().deleteOne(verificationTokenDoc);
    await this.grpcSdk.state!.setKey(
      'verifiedToken_' + verificationTokenDoc.token,
      JSON.stringify(redirectUri ? { customRedirectUri: redirectUri } : {}),
      10 * 60 * 60 * 1000,
    );

    await Promise.all([userPromise, tokenPromise]);

    this.grpcSdk.bus?.publish('authentication:verified:user', JSON.stringify(user));

    return { redirect: redirectUri ?? config.local.verification.redirect_uri };
  }

  async verifyChangeEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { verificationToken } = call.request.params.verificationToken;
    const config = ConfigController.getInstance().config;
    const token: Token | null = await Token.getInstance().findOne(
      {
        tokenType: TokenType.CHANGE_EMAIL_TOKEN,
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
    const redirectUri =
      token.data.customRedirectUri ?? config.local.verification.redirect_uri;
    await Token.getInstance()
      .deleteMany({ user: user._id, tokenType: TokenType.CHANGE_EMAIL_TOKEN })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    await User.getInstance().findByIdAndUpdate(user._id as string, {
      email: token.data.email,
    });
    return redirectUri ? { redirect: redirectUri } : 'Email changed successfully';
  }

  async resendVerificationEmail(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const email = call.request.params.email.toLowerCase();
    const invalidAddress = AuthUtils.invalidEmailAddress(email);
    if (invalidAddress) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid email address provided');
    }
    const user: User | null = await User.getInstance().findOne({ email });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    if (user.isVerified)
      throw new GrpcError(status.FAILED_PRECONDITION, 'User already verified');
    if (user.isAnonymous) throw new GrpcError(status.PERMISSION_DENIED, 'Anonymous user');

    const verificationToken: Token | null = await Token.getInstance().findOne({
      tokenType: TokenType.VERIFICATION_TOKEN,
      user: user._id,
    });
    if (!isNil(verificationToken) && AuthUtils.checkResendThreshold(verificationToken)) {
      await Token.getInstance().deleteMany({
        user: user._id,
        tokenType: TokenType.VERIFICATION_TOKEN,
      });
    }
    await this.handleEmailVerification(user);
    return 'Verification code sent';
  }

  async verifyEmailWithCode(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { email, code } = call.request.params;
    const foundUser = await User.getInstance().findOne({ email });
    if (!foundUser) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    if (foundUser.isVerified) {
      throw new GrpcError(status.FAILED_PRECONDITION, 'User already verified');
    }
    if (foundUser.isAnonymous) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Anonymous user');
    }
    const verificationTokenDoc: Token | null = await Token.getInstance().findOne({
      tokenType: TokenType.VERIFICATION_TOKEN,
      user: foundUser._id,
    });
    if (isNil(verificationTokenDoc)) {
      throw new GrpcError(status.NOT_FOUND, 'Verification token not found');
    }
    const emailHash = createHash('sha256').update(email).digest('hex');
    const otp = await this.grpcSdk.state!.getKey(emailHash);
    if (!otp || otp !== code) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid verification code');
    }
    await this.grpcSdk.state!.clearKey(emailHash);
    await User.getInstance().findByIdAndUpdate(foundUser._id, { isVerified: true });
    await Token.getInstance().deleteOne({ _id: verificationTokenDoc._id });
    this.grpcSdk.bus?.publish('authentication:verified:user', JSON.stringify(foundUser));

    const config = ConfigController.getInstance().config;
    const redirectUri = AuthUtils.validateRedirectUri(
      verificationTokenDoc.data ? verificationTokenDoc.data.customRedirectUri : undefined,
    );
    return { redirect: redirectUri ?? config.local.verification.redirect_uri };
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

  private async handleEmailVerification(user: User, redirectUri?: string | undefined) {
    const config = ConfigController.getInstance().config;
    const verificationToken: Token = await Token.getInstance().create({
      tokenType: TokenType.VERIFICATION_TOKEN,
      user: user._id,
      token: uuid(),
      data: {
        customRedirectUri: AuthUtils.validateRedirectUri(redirectUri),
      },
    });

    if (config.local.verification.method === 'link') {
      const serverConfig = await this.grpcSdk.config.get('router');
      const url = serverConfig.hostUrl;
      const result = { verificationToken, hostUrl: url };
      const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
      await this.emailModule.sendEmail('EmailVerification', {
        email: user.email,
        variables: {
          link,
        },
      });
    } else {
      const otp = AuthUtils.generateOtp();
      const emailHash = createHash('sha256').update(user.email).digest('hex');
      await this.emailModule.sendEmail('EmailVerificationWithCode', {
        email: user.email,
        variables: {
          code: otp,
        },
      });
      await this.grpcSdk.state!.setKey(emailHash, otp, 2 * 60 * 1000);
    }
  }
}
