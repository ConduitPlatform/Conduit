import { isNil } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { User } from '../models/index.js';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { Config } from '../config/index.js';
import ethUtil from 'ethereumjs-util';

export class MetamaskHandlers implements IAuthenticationStrategy {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async declareRoutes(routingManager: RoutingManager): Promise<void> {
    routingManager.route(
      {
        path: '/metamask/nonce',
        action: ConduitRouteActions.POST,
        description:
          'Returns a nonce for the user to sign using their wallet. If no user exists with the provided public address, a new user will be created.',
        bodyParams: { ethPublicAddress: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('MetamaskNonce', {
        nonce: ConduitString.Required,
      }),
      this.getNonce.bind(this),
    );
    routingManager.route(
      {
        path: '/metamask/authenticate',
        action: ConduitRouteActions.POST,
        description:
          'Authenticates a user using their Metamask wallet. The user must sign a message containing their nonce, which is then verified against the provided public address.',
        bodyParams: {
          ethPublicAddress: ConduitString.Required,
          signature: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('MetamaskAuthentication', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authenticate.bind(this),
    );
  }

  async validate(): Promise<boolean> {
    const config: Config = ConfigController.getInstance().config;
    if (config.metamask.enabled) {
      return true;
    } else {
      ConduitGrpcSdk.Logger.log('Metamask authentication not available');
      return false;
    }
  }

  async getNonce(call: ParsedRouterRequest) {
    const { ethPublicAddress } = call.request.params;
    const normalizedEthPublicAddress = ethPublicAddress.toLowerCase();

    const metamaskQuery: Indexable = {
      'metamask.ethPublicAddress': normalizedEthPublicAddress,
    };

    const existingUser: User | null = await User.getInstance().findOne(metamaskQuery);

    if (existingUser) {
      return { nonce: existingUser.metamask!.nonce };
    }

    const nonce = uuid();
    await User.getInstance().create({
      metamask: {
        ethPublicAddress: normalizedEthPublicAddress,
        nonce,
      },
    });

    return { nonce };
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');

    const { ethPublicAddress, signature } = call.request.params;
    const normalizedEthPublicAddress = ethPublicAddress.toLowerCase();
    const context = call.request.context;
    if (isNil(context)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    }

    const metamaskQuery: Indexable = {
      'metamask.ethPublicAddress': normalizedEthPublicAddress,
    };

    const user = await User.getInstance().findOne(metamaskQuery);

    if (isNil(user)) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'No user found with the provided ETH public address',
      );
    }

    const message = `I am signing my one-time nonce: ${user.metamask!.nonce}`;
    const msgBuffer = Buffer.from(message, 'utf8');
    const msgHash = ethUtil.hashPersonalMessage(msgBuffer);

    let signatureParams;
    try {
      signatureParams = ethUtil.fromRpcSig(signature);
    } catch (e) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature format');
    }

    let publicKey;
    try {
      publicKey = ethUtil.ecrecover(
        msgHash,
        signatureParams.v,
        signatureParams.r,
        signatureParams.s,
      );
    } catch (e) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Signature recovery failed');
    }

    const addressBuffer = ethUtil.publicToAddress(publicKey);
    const recoveredAddress = ethUtil.bufferToHex(addressBuffer).toLowerCase();

    if (recoveredAddress !== normalizedEthPublicAddress) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'Signature does not match public address',
      );
    }

    const nonceUpdate: Indexable = {
      'metamask.nonce': uuid(),
    };

    await User.getInstance().findByIdAndUpdate(user._id, nonceUpdate);

    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');
    const config = ConfigController.getInstance().config;
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId: context.clientId,
      config,
    });
  }
}
