import { isNil, merge } from 'lodash-es';
import { AuthUtils } from '../utils/index.js';
import {
  AUTH_CREDENTIALS,
  EMAIL_CODE_VERIFY,
  EMAIL_SEND_STRICT,
  EMAIL_VERIFY_HOOK,
  PASSWORD_RESET_SUBMIT,
  TokenType,
} from '../constants/index.js';
import { v4 as uuid } from 'uuid';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  Email,
  GrpcError,
  Indexable,
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
  ConduitBoolean,
  ConduitJson,
  ConduitString,
  ConfigController,
  RoutingManager,
  ModuleError,
} from '@conduitplatform/module-tools';
import { createHash } from 'crypto';
import { authenticateChecks, changePassword } from './utils.js';
import { errors } from '../errors.js';
import {
  assertAnonymousRealmAllowed,
  assertAnonymousUserInRealm,
  assertGlobalStrategyAvailable,
  assertStrategyEnabledForRealm,
  grantHomeMembership,
  grantHomeMembershipForRegistration,
  homeRealmFields,
  isInviteRequired,
  loginVerificationOverride,
  realmIdOf,
  realmParam,
  resolveHomeRealmContext,
  resolveInvitationRealm,
  resolveRealmFromCall,
  resolveSignInPrincipal,
  rollbackUserOnFailure,
  scopedUserQuery,
} from './realmRequest.js';
import { anyRealmEnables } from '../utils/strategyRealms.js';
import {
  assertDiscoveryAllowed,
  DISCOVERY_RESPONSE_FIELDS,
  discoverWithPassword,
} from './realmDiscovery.js';
import {
  accountLinkOffered,
  assertIdentifierFreeForUser,
  assertRealmPrincipalFree,
  identifierQuery,
  RealmContext,
  uniqueIdentifierQuery,
} from '../utils/realm.js';

type TeamsConfig = { enabled: boolean; allowRegistrationWithoutInvite: boolean };

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
          realm: realmParam,
        },
        middlewares: localRouteMiddleware,
        errors: [
          errors.USER_EXISTS,
          errors.ACCOUNT_LINK_AVAILABLE,
          errors.INVITATION_REQUIRED,
          errors.INVALID_INVITATION,
          errors.EMAIL_NOT_ALLOWED,
          errors.REALM_NOT_FOUND,
          errors.REALMS_DISABLED,
          errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
        ],
        rateLimit: AUTH_CREDENTIALS,
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
            realm: realmParam,
          },
          description: `Creates a new anonymous user.`,
          rateLimit: AUTH_CREDENTIALS,
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
         Tokens are returned according to configuration. With discover (and the realm discovery login enabled) it lists the realms of the accounts that accept the credentials instead, and opens no session.`,
        bodyParams: {
          email: ConduitString.Required,
          password: ConduitString.Required,
          captchaToken: ConduitString.Optional,
          realm: realmParam,
          discover: ConduitBoolean.Optional,
        },
        middlewares:
          captchaConfig.enabled && captchaConfig.routes.login
            ? ['captchaMiddleware']
            : undefined,
        rateLimit: AUTH_CREDENTIALS,
      },
      new ConduitRouteReturnDefinition('LoginResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
        ...DISCOVERY_RESPONSE_FIELDS,
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
            realm: realmParam,
          },
          rateLimit: EMAIL_SEND_STRICT,
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
        rateLimit: PASSWORD_RESET_SUBMIT,
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
            realm: realmParam,
          },
          rateLimit: EMAIL_SEND_STRICT,
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
      changePassword.bind(this),
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
        errors: [errors.EMAIL_NOT_ALLOWED],
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
            realm: realmParam,
          },
          rateLimit: EMAIL_CODE_VERIFY,
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
        rateLimit: EMAIL_VERIFY_HOOK,
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
        rateLimit: EMAIL_VERIFY_HOOK,
      },
      new ConduitRouteReturnDefinition('VerifyChangeEmailResponse', 'String'),
      this.verifyChangeEmail.bind(this),
    );
  }

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    // a realm may enable local on its own: the email client and templates are needed
    // then as well
    if (config.local.enabled || (await anyRealmEnables('local'))) {
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

    const config = ConfigController.getInstance().config;
    const teams: TeamsConfig = config.teams;
    const realmCtx = await this.resolveRegistrationRealm(
      call,
      email,
      invitationToken,
      teams,
    );
    const { anonymousUser } = call.request.context;
    if (anonymousUser) {
      assertAnonymousUserInRealm(anonymousUser, realmCtx);
    }
    const { isVerified, userInvitationExtensionData } =
      await this.acceptRegistrationInvite(realmCtx, invitationToken, email, teams);
    AuthUtils.assertValidEmail(email, 'module');
    await this.assertEmailAvailable(email, realmCtx);
    if (userData) {
      AuthUtils.checkUserData(userData);
    }

    const user = await this.createRegisteredUser({
      email,
      password,
      isVerified,
      anonymousUser,
      userInvitationExtensionData,
      userData,
      realmCtx,
      invitationToken,
    });
    this.grpcSdk.bus?.publish('authentication:register:user', JSON.stringify(user));
    callback({ user });

    await this.completeRegistration(user, {
      sendEmail: config.local.verification.send_email,
      isVerified,
      redirectUri,
      invitationToken,
      anonymousUser,
      realmCtx,
    });
  }

  async anonymousRegister(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const email = `${uuid()}@anonymous.com`;
    const { userData } = call.request.params;
    const config = ConfigController.getInstance().config;
    const realmCtx = await resolveRealmFromCall(call);
    if (!realmCtx) assertGlobalStrategyAvailable('local');
    assertStrategyEnabledForRealm(realmCtx, 'local');
    if (realmCtx && isInviteRequired(realmCtx.effective.registration, config.teams)) {
      throw new ModuleError(
        errors.INVITATION_REQUIRED,
        'Anonymous registration is not allowed without an invitation in this realm',
      );
    }
    if (userData) {
      AuthUtils.checkUserData(userData);
    }
    const context = call.request.context;
    // refused by the realm policies (2FA, verified email, client pinning): fail before
    // a user is created
    assertAnonymousRealmAllowed(realmCtx, context.clientId);
    const anonymousUser = await User.getInstance().create({
      email,
      isAnonymous: true,
      isVerified: false,
      ...userData,
      ...homeRealmFields(realmCtx),
    });
    if (realmCtx) {
      await rollbackUserOnFailure(this.grpcSdk, anonymousUser, () =>
        grantHomeMembership(this.grpcSdk, anonymousUser, realmCtx),
      );
    } else {
      await TeamsHandler.getInstance()
        .addUserToDefault(anonymousUser)
        .catch(err => {
          ConduitGrpcSdk.Logger.error(err);
        });
    }
    // a failure here must not leave the new anonymous user behind either
    return rollbackUserOnFailure(this.grpcSdk, anonymousUser, () =>
      TokenProvider.getInstance().provideUserTokens({
        user: anonymousUser,
        clientId: context.clientId,
        config,
        isRefresh: false,
        realm: realmIdOf(realmCtx),
      }),
    );
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

    // discovery: no realm, no session, the answer lists the realms that accepted the password
    assertDiscoveryAllowed({
      discover: call.request.params.discover === true,
      realm: call.request.params.realm,
    });
    if (call.request.params.discover === true) {
      return discoverWithPassword({
        identifier: { email },
        password,
        strategyKey: 'local',
        clientId,
      });
    }

    const config = ConfigController.getInstance().config;
    const realmCtx = await resolveRealmFromCall(call);
    if (!realmCtx) assertGlobalStrategyAvailable('local');

    const principal = await resolveSignInPrincipal(realmCtx, { email }, 'local', {
      select: '+hashedPassword',
    });
    if (isNil(principal))
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');
    await authenticateChecks(
      password,
      config,
      principal.user,
      loginVerificationOverride(realmCtx, principal, config.local.verification.required),
    );
    return TokenProvider.getInstance().provideUserTokens({
      user: principal.user,
      clientId,
      config,
      realm: realmIdOf(realmCtx),
    });
  }

  async forgotPassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const email = call.request.params.email.toLowerCase();
    const config = ConfigController.getInstance().config;
    const redirectUri =
      AuthUtils.validateRedirectUri(call.request.bodyParams.redirectUri) ??
      config.local.forgot_password_redirect_uri;
    const realmCtx = await resolveRealmFromCall(call);
    if (!realmCtx) assertGlobalStrategyAvailable('local');

    const user: User | null =
      (
        await resolveSignInPrincipal(realmCtx, { email }, 'local', {
          select: '+hashedPassword',
        })
      )?.user ?? null;

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

    const oldToken: Token | null = await Token.getInstance().findOne(
      {
        tokenType: TokenType.PASSWORD_RESET_TOKEN,
        user: user._id,
      },
      { readPreference: 'primary' },
    );
    if (!isNil(oldToken) && AuthUtils.checkResendThreshold(oldToken)) {
      await Token.getInstance().deleteOne(oldToken);
    }

    const passwordResetTokenDoc = await Token.getInstance().create({
      tokenType: TokenType.PASSWORD_RESET_TOKEN,
      user: user._id,
      token: uuid(),
    });
    const safeUser = { ...user };
    delete safeUser.hashedPassword;
    const link = `${redirectUri}?reset_token=${passwordResetTokenDoc.token}`;
    if (this.grpcSdk.isAvailable('email')) {
      await this.emailModule
        .sendEmail('ForgotPassword', {
          email: user.email,
          variables: {
            link,
            user: safeUser,
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

    const passwordResetTokenDoc: Token | null = await Token.getInstance().findOne(
      {
        tokenType: TokenType.PASSWORD_RESET_TOKEN,
        token: passwordResetTokenParam,
      },
      { readPreference: 'primary' },
    );
    if (isNil(passwordResetTokenDoc))
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid parameters');

    const user: User | null = await User.getInstance().findOne(
      { _id: passwordResetTokenDoc.user as string },
      { select: '+hashedPassword' },
    );
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    // the realm comes from the user the token was issued for
    assertStrategyEnabledForRealm(await resolveHomeRealmContext(user), 'local');
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

    TokenProvider.getInstance().trackLoggedOutUserMetric(user._id);

    return 'Password reset successful';
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
    AuthUtils.assertValidEmail(newEmail, 'module');
    await assertIdentifierFreeForUser(
      user,
      identifierQuery('email', newEmail),
      'Email address already taken',
    );

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
        const safeUser = { ...user };
        delete safeUser.hashedPassword;
        await this.emailModule
          .sendEmail('ChangeEmailVerification', {
            email: newEmail,
            variables: {
              link,
              user: safeUser,
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
      { populate: ['user'], readPreference: 'primary' },
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
    const verificationToken = call.request.params.verificationToken;
    const config = ConfigController.getInstance().config;
    const token: Token | null = await Token.getInstance().findOne(
      {
        tokenType: TokenType.CHANGE_EMAIL_TOKEN,
        token: verificationToken,
      },
      { populate: ['user'], readPreference: 'primary' },
    );
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Change email token does not exist');
    }
    const user: User = token.user as User;
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    // the address may have been taken since the change was requested
    const newEmail = token.data?.email;
    if (typeof newEmail !== 'string' || newEmail === '') {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Change email token is malformed');
    }
    await assertIdentifierFreeForUser(
      user,
      identifierQuery('email', newEmail),
      'Email address already taken',
    );
    const redirectUri =
      token.data.customRedirectUri ?? config.local.verification.redirect_uri;
    await Token.getInstance()
      .deleteMany({ user: user._id, tokenType: TokenType.CHANGE_EMAIL_TOKEN })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    await User.getInstance().findByIdAndUpdate(user._id as string, {
      email: newEmail,
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
    const realmCtx = await resolveRealmFromCall(call);
    if (!realmCtx) assertGlobalStrategyAvailable('local');
    assertStrategyEnabledForRealm(realmCtx, 'local');
    const user: User | null = await User.getInstance().findOne(
      scopedUserQuery({ email }, realmCtx),
    );
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    if (user.isVerified)
      throw new GrpcError(status.FAILED_PRECONDITION, 'User already verified');
    if (user.isAnonymous) throw new GrpcError(status.PERMISSION_DENIED, 'Anonymous user');

    const verificationToken: Token | null = await Token.getInstance().findOne(
      {
        tokenType: TokenType.VERIFICATION_TOKEN,
        user: user._id,
      },
      { readPreference: 'primary' },
    );
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
    const email = call.request.params.email.toLowerCase();
    const { code } = call.request.params;
    const realmCtx = await resolveRealmFromCall(call);
    if (!realmCtx) assertGlobalStrategyAvailable('local');
    assertStrategyEnabledForRealm(realmCtx, 'local');
    const foundUser = await User.getInstance().findOne(
      scopedUserQuery({ email }, realmCtx),
      { readPreference: 'primary' },
    );
    if (!foundUser) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    if (foundUser.isVerified) {
      throw new GrpcError(status.FAILED_PRECONDITION, 'User already verified');
    }
    if (foundUser.isAnonymous) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Anonymous user');
    }
    const verificationTokenDoc: Token | null = await Token.getInstance().findOne(
      {
        tokenType: TokenType.VERIFICATION_TOKEN,
        user: foundUser._id,
      },
      { readPreference: 'primary' },
    );
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

    return 'OK';
  }

  private async resolveRegistrationRealm(
    call: ParsedRouterRequest,
    email: string,
    invitationToken: string | undefined,
    teams: TeamsConfig,
  ): Promise<RealmContext | null> {
    let realmCtx = await resolveRealmFromCall(call);
    if ((teams.enabled || realmCtx) && invitationToken) {
      // an invitation into a realm implies that realm and must agree with an explicit one
      realmCtx = await resolveInvitationRealm(realmCtx, invitationToken, {
        allowImplied: true,
      });
    }
    if (!realmCtx) assertGlobalStrategyAvailable('local');
    assertStrategyEnabledForRealm(realmCtx, 'local');
    if (
      isInviteRequired(realmCtx?.effective.registration, teams) &&
      isNil(invitationToken)
    ) {
      throw new ModuleError(
        errors.INVITATION_REQUIRED,
        `User with email ${email} tried registering without providing an invitation token`,
      );
    }
    return realmCtx;
  }

  private async acceptRegistrationInvite(
    realmCtx: RealmContext | null,
    invitationToken: string | undefined,
    email: string,
    teams: TeamsConfig,
  ): Promise<{ isVerified: boolean; userInvitationExtensionData: any }> {
    if (!((teams.enabled || realmCtx) && invitationToken)) {
      return { isVerified: false, userInvitationExtensionData: undefined };
    }
    const valid = await TeamsHandler.getInstance().inviteValidation(
      invitationToken,
      email,
    );
    if (!valid) {
      throw new ModuleError(
        errors.INVALID_INVITATION,
        `User with email ${email} tried registering with an invalid invitation token: ${invitationToken}`,
      );
    }
    const isVerified = await TeamsHandler.getInstance().verifyUserViaInvitation(
      invitationToken,
      email,
    );
    const userInvitationExtensionData = await Token.getInstance()
      .findOne(
        {
          tokenType: TokenType.TEAM_INVITE_TOKEN,
          token: invitationToken,
        },
        { readPreference: 'primary' },
      )
      .then(token => {
        if (token?.data?.userData) {
          AuthUtils.checkUserData(token.data.userData);
        }
        return token?.data?.userData;
      });
    return { isVerified, userInvitationExtensionData };
  }

  private async assertEmailAvailable(email: string, realmCtx: RealmContext | null) {
    const user: User | null = await User.getInstance().findOne(
      uniqueIdentifierQuery({ email }, realmIdOf(realmCtx)),
    );
    if (!isNil(user)) {
      // shared mode: the address belongs to an account of another realm, which may be
      // connected to this realm instead of a second one being refused
      const linkable = await accountLinkOffered(realmCtx, user);
      throw new ModuleError(
        linkable ? errors.ACCOUNT_LINK_AVAILABLE : errors.USER_EXISTS,
        `User with email ${email} already exists`,
      );
    }
    if (realmCtx) {
      // a linked guest of the realm holding the address is a principal there too
      await assertRealmPrincipalFree(
        realmIdOf(realmCtx),
        [identifierQuery('email', email)],
        {
          conflict: 'USER_EXISTS',
        },
      );
    }
  }

  private async createRegisteredUser(params: {
    email: string;
    password: string;
    isVerified: boolean;
    anonymousUser: User | undefined;
    userInvitationExtensionData: any;
    userData: Indexable | undefined;
    realmCtx: RealmContext | null;
    invitationToken: string | undefined;
  }): Promise<User> {
    const { email, isVerified, anonymousUser, realmCtx, invitationToken } = params;
    const hashedPassword = await AuthUtils.hashPassword(params.password);
    let user: User;
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
        ...merge(params.userInvitationExtensionData ?? {}, params.userData ?? {}),
        ...homeRealmFields(realmCtx),
      });
    }
    delete user.hashedPassword;

    if (realmCtx && !anonymousUser) {
      // an invitation into the realm creates the team relation itself, otherwise the
      // user becomes a plain member of the realm team. Before the response: a failure
      // rolls the new user back and reaches the caller.
      const createdUser = user;
      await rollbackUserOnFailure(this.grpcSdk, createdUser, () =>
        grantHomeMembershipForRegistration(
          this.grpcSdk,
          createdUser,
          realmCtx,
          invitationToken,
        ),
      );
    }
    return user;
  }

  private async completeRegistration(
    user: User,
    options: {
      sendEmail: boolean;
      isVerified: boolean;
      redirectUri: string | undefined;
      invitationToken: string | undefined;
      anonymousUser: User | undefined;
      realmCtx: RealmContext | null;
    },
  ) {
    const { invitationToken, anonymousUser, realmCtx } = options;
    if (options.sendEmail && this.grpcSdk.isAvailable('email') && !options.isVerified) {
      await this.handleEmailVerification(user, options.redirectUri).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    }

    if (invitationToken) {
      await TeamsHandler.getInstance()
        .addUserToTeam(user, invitationToken)
        .catch(err => {
          ConduitGrpcSdk.Logger.error(err);
        });
    } else if (!anonymousUser && !realmCtx) {
      await TeamsHandler.getInstance()
        .addUserToDefault(user)
        .catch(err => {
          ConduitGrpcSdk.Logger.error(err);
        });
    }
  }

  private async initDbAndEmail() {
    if (this.grpcSdk.isAvailable('email')) {
      this.emailModule = this.grpcSdk.emailProvider!;
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

    const safeUser = { ...user };
    delete safeUser.hashedPassword;
    if (config.local.verification.method === 'link') {
      const serverConfig = await this.grpcSdk.config.get('router');
      const url = serverConfig.hostUrl;
      const result = { verificationToken, hostUrl: url };
      const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
      await this.emailModule.sendEmail('EmailVerification', {
        email: user.email,
        variables: {
          link,
          user: safeUser,
        },
      });
    } else {
      const otp = AuthUtils.generateOtp();
      const emailHash = createHash('sha256').update(user.email).digest('hex');
      await this.emailModule.sendEmail('EmailVerificationWithCode', {
        email: user.email,
        variables: {
          code: otp,
          user: safeUser,
        },
      });
      await this.grpcSdk.state!.setKey(emailHash, otp, 2 * 60 * 1000);
    }
  }
}
