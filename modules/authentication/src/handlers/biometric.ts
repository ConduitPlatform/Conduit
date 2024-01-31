import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';

import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { Token, User } from '../models/index.js';
import { AuthUtils } from '../utils/index.js';
import { TokenType } from '../constants/index.js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { BiometricToken } from '../models/BiometricToken.schema.js';

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
        path: '/biometrics',
        action: ConduitRouteActions.POST,
        description: `Endpoint that can be used to authenticate with
        biometric authentication from mobile devices. 
        It expects the key ID that you will be using to encrypt the data with.`,
        bodyParams: {
          encryptedData: ConduitString.Required,
          keyId: ConduitString.Required,
        },
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

  async biometricLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const { encryptedData, keyId } = call.request.params;
    const config = ConfigController.getInstance().config;
    const key = await BiometricToken.getInstance().findOne(
      {
        _id: keyId,
      },
      undefined,
      'user',
    );
    if (!key) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Key not found!');
    }
    const verifier = crypto.createVerify('sha256WithRSAEncryption');
    verifier.update(Buffer.from((key.user as User)._id));
    const cryptoKey = crypto.createPublicKey({
      key: key.publicKey,
      format: 'der',
      type: 'spki',
      encoding: 'base64',
    });
    const verificationResult = verifier.verify(cryptoKey, encryptedData, 'base64');
    if (!verificationResult) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
    }
    return TokenProvider.getInstance().provideUserTokens({
      user: key.user as User,
      clientId: call.request.context.clientId,
      config,
    });
  }

  async enroll(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { publicKey } = call.request.params;
    const { clientId, user } = call.request.context;
    const existingToken = await Token.getInstance().findOne({
      tokenType: TokenType.REGISTER_BIOMETRICS_TOKEN,
      user: user._id,
    });
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
    const existingToken = await Token.getInstance().findOne({
      tokenType: TokenType.REGISTER_BIOMETRICS_TOKEN,
      user: user._id,
    });
    if (!existingToken) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid token!');
    }
    if (existingToken.data.clientId !== clientId) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        "Responding client doesn't match requesting!",
      );
    }
    await Token.getInstance().deleteMany({
      tokenType: TokenType.REGISTER_BIOMETRICS_TOKEN,
      user: user._id,
    });
    const verifier = crypto.createVerify('sha256WithRSAEncryption');
    verifier.update(Buffer.from(existingToken.data.challenge));
    const cryptoKey = crypto.createPublicKey({
      key: existingToken.data.publicKey,
      format: 'der',
      type: 'spki',
      encoding: 'base64',
    });
    const verificationResult = verifier.verify(cryptoKey, encryptedData, 'base64');
    if (!verificationResult) {
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
