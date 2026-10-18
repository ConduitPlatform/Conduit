import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';

import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { Token, User } from '../models/index.js';
import { ALT_STRATEGY_AUTH, TokenType } from '../constants/index.js';
import { AuthUtils } from '../utils/index.js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import { errors } from '../errors.js';
import {
  assertStrategyEnabledForRealm,
  isHomeRealm,
  realmIdOf,
  realmParam,
  resolveRealmFromCall,
  resolveRealmFromSlug,
} from './realmRequest.js';
import { realmsEnabled } from '../utils/realm.js';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { BiometricToken } from '../models/BiometricToken.schema.js';
import {
  BIOMETRIC_CHALLENGE_UNAVAILABLE,
  consumeBiometricChallenge,
  isBiometricChallengeExpired,
  issueOrReuseBiometricLoginChallenge,
  verifyBiometricSignature,
} from '../utils/biometricAuth.js';

export class BiometricHandlers implements IAuthenticationStrategy {
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    if (config.biometricAuthentication.enabled) {
      ConduitGrpcSdk.Logger.log('Biometric authentication is available');
      return (this.initialized = true);
    } else {
      ConduitGrpcSdk.Logger.log('Biometric authentication not available');
      return (this.initialized = false);
    }
  }

  async declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/biometrics/challenge',
        action: ConduitRouteActions.POST,
        description: `Issues a one-time challenge to sign for biometric login.`,
        bodyParams: {
          keyId: ConduitString.Required,
          realm: realmParam,
        },
        errors: [
          errors.REALM_NOT_FOUND,
          errors.REALMS_DISABLED,
          errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
        ],
        rateLimit: ALT_STRATEGY_AUTH,
      },
      new ConduitRouteReturnDefinition('BiometricsChallengeResponse', {
        challenge: ConduitString.Required,
      }),
      this.biometricChallenge.bind(this),
    );
    routingManager.route(
      {
        path: '/biometrics',
        action: ConduitRouteActions.POST,
        description: `Endpoint that can be used to authenticate with
        biometric authentication from mobile devices. 
        It expects the key ID that you will be using to encrypt the data with.`,
        bodyParams: {
          encryptedData: ConduitString.Required,
          keyId: ConduitString.Required,
        },
        rateLimit: ALT_STRATEGY_AUTH,
      },
      new ConduitRouteReturnDefinition('BiometricsAuthenticateResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.biometricLogin.bind(this),
    );
    routingManager.route(
      {
        path: '/biometrics/enroll',
        action: ConduitRouteActions.POST,
        description: `Endpoint that can be used to enroll a user with
        biometric authentication from mobile devices.`,
        bodyParams: {
          publicKey: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('BiometricsEnrollResponse', {
        challenge: ConduitString.Required,
      }),
      this.enroll.bind(this),
    );
    routingManager.route(
      {
        path: '/biometrics/enroll/verify',
        action: ConduitRouteActions.POST,
        description: `Verifies the encrypted information which is used for biometric authentication.
         The identifier field is either the user id when logging in or the token when registering (user or the method).`,
        bodyParams: {
          encryptedData: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('VerifyBiometricEnrollResponse', {
        keyId: ConduitString.Required,
      }),
      this.biometricVerifyEnroll.bind(this),
    );
  }

  async biometricChallenge(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { keyId } = call.request.params;
    const clientId = call.request.context.clientId;
    if (!clientId) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    const realmCtx = await resolveRealmFromCall(call);
    assertStrategyEnabledForRealm(realmCtx, 'biometric');
    const key = await BiometricToken.getInstance().findOne(
      { _id: keyId },
      { readPreference: 'primary' },
    );
    if (!key || !key.user) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    if (!this.grpcSdk.state) {
      throw new GrpcError(status.UNAVAILABLE, BIOMETRIC_CHALLENGE_UNAVAILABLE);
    }
    const userId = typeof key.user === 'string' ? key.user : key.user._id;
    // the key must belong to a user of the realm the challenge is requested for
    if (realmCtx || realmsEnabled()) {
      const keyOwner = await User.getInstance().findOne(
        { _id: userId },
        { readPreference: 'primary' },
      );
      if (!keyOwner || !isHomeRealm(keyOwner.homeRealm, realmIdOf(realmCtx))) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
      }
    }
    const scopedQuery = {
      tokenType: TokenType.LOGIN_BIOMETRICS_TOKEN,
      'data.keyId': keyId,
      'data.clientId': clientId,
    } as Query<Token>;
    const challenge = await issueOrReuseBiometricLoginChallenge(keyId, clientId, {
      usingLock: (resource, ttl, fn) => this.grpcSdk.state!.usingLock(resource, ttl, fn),
      findNewest: async () => {
        const existingTokens = await Token.getInstance().findMany(scopedQuery, {
          sort: { createdAt: -1 },
          limit: 1,
          readPreference: 'primary',
        });
        return existingTokens[0] ?? null;
      },
      deleteScope: () => Token.getInstance().deleteMany(scopedQuery),
      createToken: nextChallenge =>
        Token.getInstance().create({
          tokenType: TokenType.LOGIN_BIOMETRICS_TOKEN,
          user: userId,
          data: {
            clientId,
            challenge: nextChallenge,
            keyId,
            ...(realmCtx ? { realm: realmCtx.team.realm!.slug } : {}),
          },
          token: uuid(),
        }),
    });
    return {
      challenge,
    };
  }

  async biometricLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const { encryptedData, keyId } = call.request.params;
    const clientId = call.request.context.clientId;
    if (!clientId) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    const config = ConfigController.getInstance().config;
    const existingTokens = await Token.getInstance().findMany(
      {
        tokenType: TokenType.LOGIN_BIOMETRICS_TOKEN,
        'data.keyId': keyId,
        'data.clientId': clientId,
      } as Query<Token>,
      { sort: { createdAt: -1 }, limit: 1, readPreference: 'primary' },
    );
    const existingToken = existingTokens[0];
    if (!existingToken) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    const tokenClientId = await consumeBiometricChallenge(existingToken, clientId, id =>
      Token.getInstance().deleteOne({ _id: id }),
    );
    if (isBiometricChallengeExpired(existingToken.createdAt)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    const key = await BiometricToken.getInstance().findOne(
      { _id: keyId },
      { populate: ['user'], readPreference: 'primary' },
    );
    if (!key || !key.user) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    if (
      !verifyBiometricSignature(
        key.publicKey,
        existingToken.data.challenge,
        encryptedData,
      )
    ) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    // the realm comes from the challenge; a key owner from another home realm looks
    // like any other invalid signature
    const realmCtx = await resolveRealmFromSlug(existingToken.data.realm);
    assertStrategyEnabledForRealm(realmCtx, 'biometric');
    if (!isHomeRealm((key.user as User).homeRealm, realmIdOf(realmCtx))) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    return TokenProvider.getInstance().provideUserTokens({
      user: key.user as User,
      clientId: tokenClientId,
      config,
      realm: realmIdOf(realmCtx),
    });
  }

  async enroll(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { publicKey } = call.request.params;
    const { clientId, user } = call.request.context;
    const existingToken = await Token.getInstance().findOne(
      {
        tokenType: TokenType.REGISTER_BIOMETRICS_TOKEN,
        user: user._id,
      },
      { readPreference: 'primary' },
    );
    if (existingToken) {
      AuthUtils.checkResendThreshold(existingToken);
      await Token.getInstance().deleteMany({
        tokenType: TokenType.REGISTER_BIOMETRICS_TOKEN,
        user: user._id,
      });
    }
    const challenge = crypto.randomBytes(64).toString('hex');
    const token = await Token.getInstance().create({
      tokenType: TokenType.REGISTER_BIOMETRICS_TOKEN,
      user: user._id,
      data: {
        clientId,
        challenge,
        publicKey,
      },
      token: uuid(),
    });
    return {
      challenge,
    };
  }

  async biometricVerifyEnroll(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { encryptedData } = call.request.params;
    const { clientId, user } = call.request.context;
    const existingToken = await Token.getInstance().findOne(
      {
        tokenType: TokenType.REGISTER_BIOMETRICS_TOKEN,
        user: user._id,
      },
      { readPreference: 'primary' },
    );
    if (!existingToken) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    await consumeBiometricChallenge(existingToken, clientId, id =>
      Token.getInstance().deleteOne({ _id: id }),
    );
    if (
      !verifyBiometricSignature(
        existingToken.data.publicKey,
        existingToken.data.challenge,
        encryptedData,
      )
    ) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    const biometricToken = await BiometricToken.getInstance().create({
      user: user._id,
      publicKey: existingToken.data.publicKey,
    });
    return {
      keyId: biometricToken._id,
    };
  }
}
