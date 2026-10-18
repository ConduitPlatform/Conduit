import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  SMS,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';

import {
  ConduitJson,
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { Token, User } from '../models/index.js';
import { AuthUtils } from '../utils/index.js';
import { PHONE_CODE_VERIFY, PHONE_SMS_SEND, TokenType } from '../constants/index.js';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy.js';
import { TokenProvider } from './tokenProvider.js';
import { v4 as uuid } from 'uuid';
import { TeamsHandler } from './team.js';
import { errors } from '../errors.js';
import { RealmContext } from '../utils/realm.js';
import {
  assertAnonymousUserInRealm,
  assertStrategyEnabledForRealm,
  grantHomeMembershipForRegistration,
  homeRealmFields,
  isInviteRequired,
  realmIdOf,
  realmParam,
  resolveInvitationRealm,
  resolveRealmFromCall,
  resolveRealmFromSlug,
  scopedUserQuery,
} from './realmRequest.js';

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
    const config = ConfigController.getInstance().config;
    const captchaConfig = config.captcha;
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
          realm: realmParam,
        },
        middlewares:
          captchaConfig.enabled && captchaConfig.routes.login
            ? ['captchaMiddleware']
            : undefined,
        errors: [
          errors.REALM_NOT_FOUND,
          errors.REALMS_DISABLED,
          errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
          errors.INVALID_INVITATION,
        ],
        rateLimit: PHONE_SMS_SEND,
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
          userData: ConduitJson.Optional,
        },
        middlewares: ['authMiddleware?', 'checkAnonymousMiddleware'],
        rateLimit: PHONE_CODE_VERIFY,
      },
      new ConduitRouteReturnDefinition('VerifyPhoneLoginResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.phoneLogin.bind(this),
    );
  }

  async phoneLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { token, code, userData } = call.request.params;
    const { anonymousUser, user: existingUser } = call.request.context;
    const config = ConfigController.getInstance().config;

    const existingToken: Token | null = await Token.getInstance().findOne(
      { token: token },
      { readPreference: 'primary' },
    );
    if (!existingToken) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid token provided');
    }
    const verified = await AuthUtils.verifyCode(this.grpcSdk, existingToken, code);
    if (!verified) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Code verification unsuccessful');
    }

    // the realm the code was requested for, re-validated at verification
    const realmCtx = await resolveRealmFromSlug(existingToken.data.realm);
    assertStrategyEnabledForRealm(realmCtx, 'phone');

    let user: User | null;
    if (existingToken.tokenType === TokenType.REGISTER_WITH_PHONE_NUMBER_TOKEN) {
      // phone numbers are unique across realms: a number that belongs to a user of
      // another realm cannot be registered here. The refusal happens only once the
      // code was proven so that `authenticate` does not reveal which numbers exist.
      const phoneOwner = await User.getInstance().findOne({
        phoneNumber: existingToken.data.phone,
      });
      if (phoneOwner) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Code verification unsuccessful');
      }
      user = await this.handlePhoneRegistration(
        existingUser ?? anonymousUser,
        existingToken,
        realmCtx,
        userData,
      );
    } else {
      user = await User.getInstance().findOne({ _id: existingToken.user as string });
      if (isNil(user)) throw new GrpcError(status.UNAUTHENTICATED, 'User not found');
    }
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId: existingToken.data.clientId,
      config,
      realm: realmIdOf(realmCtx),
    });
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const { phone, invitationToken } = call.request.params;
    const { clientId } = call.request.context;
    const realmCtx = await resolveRealmFromCall(call);
    assertStrategyEnabledForRealm(realmCtx, 'phone');
    const user: User | null = await User.getInstance().findOne(
      scopedUserQuery({ phoneNumber: phone }, realmCtx),
    );
    let foundInvitationToken;
    if (invitationToken) {
      foundInvitationToken = await Token.getInstance().findOne(
        { token: invitationToken },
        { readPreference: 'primary' },
      );
    }
    if (!user) {
      const teams = ConfigController.getInstance().config.teams;
      if ((teams.enabled || realmCtx) && invitationToken) {
        // an invitation into a realm must agree with the realm being registered at
        await resolveInvitationRealm(realmCtx, invitationToken);
      }
      if (
        isInviteRequired(realmCtx?.effective.registration, teams) &&
        !foundInvitationToken
      ) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'Registration requires valid invitation',
        );
      }

      if ((teams.enabled || realmCtx) && call.request.params.invitationToken) {
        const valid = await TeamsHandler.getInstance().inviteValidation(
          call.request.params.invitationToken,
        );
        if (!valid) {
          throw new GrpcError(status.PERMISSION_DENIED, 'Invalid invitation token');
        }
      }
    }
    const existingToken = await Token.getInstance().findOne(
      {
        tokenType: {
          $in: [
            TokenType.LOGIN_WITH_PHONE_NUMBER_TOKEN,
            TokenType.REGISTER_WITH_PHONE_NUMBER_TOKEN,
          ],
        },
        data: {
          phone,
        },
      },
      { readPreference: 'primary' },
    );
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
      user: user ? user._id : undefined,
      data: {
        clientId,
        phone,
        verification: verificationSid,
        invitationToken,
        ...(realmCtx ? { realm: realmCtx.team.realm!.slug } : {}),
      },
      token: uuid(),
    });
    return {
      token: token.token,
    };
  }

  private async handlePhoneRegistration(
    anonymousOrExisting: User | undefined,
    existingToken: Token,
    realmCtx: RealmContext | null,
    userData?: Indexable,
  ) {
    if (anonymousOrExisting) {
      // converting a user of another realm must fail before anything is written
      assertAnonymousUserInRealm(anonymousOrExisting, realmCtx);
      return (await User.getInstance().findByIdAndUpdate(anonymousOrExisting._id, {
        phoneNumber: existingToken.data.phone,
      })) as User;
    }
    if (userData) {
      AuthUtils.checkUserData(userData);
    }
    const user = await User.getInstance().create({
      phoneNumber: existingToken.data.phone,
      ...userData,
      ...homeRealmFields(realmCtx),
    });
    if (realmCtx) {
      // an invitation into the realm creates the team relation itself, otherwise the
      // user becomes a plain member of the realm team
      await grantHomeMembershipForRegistration(
        this.grpcSdk,
        user,
        realmCtx,
        existingToken.data.invitationToken,
      ).catch(err => {
        ConduitGrpcSdk.Logger.error(err);
      });
    }
    if (isNil(existingToken.data.invitationToken)) {
      if (!realmCtx) {
        await TeamsHandler.getInstance()
          .addUserToDefault(user)
          .catch(err => {
            ConduitGrpcSdk.Logger.error(err);
          });
      }
    } else {
      await TeamsHandler.getInstance()
        .addUserToTeam(user, existingToken.data.invitationToken)
        .catch(err => {
          ConduitGrpcSdk.Logger.error(err);
        });
    }
    return user;
  }
}
