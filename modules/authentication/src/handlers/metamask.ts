import { isNil } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { RealmMembership, User } from '../models/index.js';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import {
  ConduitString,
  ConfigController,
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { Config } from '../config/index.js';
import { ALT_STRATEGY_AUTH } from '../constants/index.js';
import { errors } from '../errors.js';
import { realmsEnabled } from '../utils/realm.js';
import {
  assertStrategyEnabledForRealm,
  grantHomeMembership,
  homeRealmFields,
  realmIdOf,
  realmParam,
  resolveRealmFromCall,
  scopedUserQuery,
} from './realmRequest.js';
import {
  bytesToHex,
  ecrecover,
  fromRPCSig,
  hashPersonalMessage,
  publicToAddress,
} from '@ethereumjs/util';

export class MetamaskHandlers implements IAuthenticationStrategy {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async declareRoutes(routingManager: RoutingManager): Promise<void> {
    routingManager.route(
      {
        path: '/metamask/nonce',
        action: ConduitRouteActions.POST,
        description:
          'Returns a nonce for the user to sign using their wallet. If no user exists with the provided public address, a new user will be created.',
        bodyParams: { ethPublicAddress: ConduitString.Required, realm: realmParam },
        errors: [
          errors.INVITATION_REQUIRED,
          errors.REALM_NOT_FOUND,
          errors.REALMS_DISABLED,
          errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
        ],
        rateLimit: ALT_STRATEGY_AUTH,
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
          realm: realmParam,
        },
        errors: [
          errors.REALM_NOT_FOUND,
          errors.REALMS_DISABLED,
          errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
        ],
        rateLimit: ALT_STRATEGY_AUTH,
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
    const realmCtx = await resolveRealmFromCall(call);
    assertStrategyEnabledForRealm(realmCtx, 'metamask');

    const existingUser: User | null = await User.getInstance().findOne(
      scopedUserQuery(
        { 'metamask.ethPublicAddress': normalizedEthPublicAddress },
        realmCtx,
      ) as Query<User>,
    );

    if (existingUser) {
      return { nonce: existingUser.metamask!.nonce };
    }

    // a nonce request registers the wallet, a wallet cannot present an invitation
    if (realmCtx && !realmCtx.effective.registration.allowWithoutInvite) {
      throw new ModuleError(errors.INVITATION_REQUIRED);
    }

    const nonce = uuid();
    if (realmCtx || realmsEnabled()) {
      // Addresses are unique across realms. A wallet that already belongs to a user of
      // another realm gets a throw-away nonce and nothing is created: addresses are
      // public, so this reveals nothing, and `authenticate` then fails through the
      // normal "No user found" path because the scoped lookup does not find the user.
      const otherRealmUser = await User.getInstance().findOne({
        'metamask.ethPublicAddress': normalizedEthPublicAddress,
      } as Query<User>);
      if (otherRealmUser) return { nonce };
    }

    // The realm membership and role are granted by the first successful `authenticate`,
    // once the wallet is proven: an unproven address must not own a membership.
    await User.getInstance().create({
      metamask: {
        ethPublicAddress: normalizedEthPublicAddress,
        nonce,
      },
      ...homeRealmFields(realmCtx),
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

    const realmCtx = await resolveRealmFromCall(call);
    assertStrategyEnabledForRealm(realmCtx, 'metamask');

    const user = await User.getInstance().findOne(
      scopedUserQuery(
        { 'metamask.ethPublicAddress': normalizedEthPublicAddress },
        realmCtx,
      ) as Query<User>,
    );

    if (isNil(user)) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'No user found with the provided ETH public address',
      );
    }

    const message = `I am signing my one-time nonce: ${user.metamask!.nonce}`;
    const msgBuffer = Buffer.from(message, 'utf8');
    const msgHash = hashPersonalMessage(msgBuffer);

    let signatureParams;
    try {
      signatureParams = fromRPCSig(signature);
    } catch (e) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature format');
    }

    let publicKey;
    try {
      publicKey = ecrecover(
        msgHash,
        signatureParams.v,
        signatureParams.r,
        signatureParams.s,
      );
    } catch (e) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Signature recovery failed');
    }

    const addressBuffer = publicToAddress(publicKey);
    const recoveredAddress = bytesToHex(addressBuffer).toLowerCase();

    if (recoveredAddress !== normalizedEthPublicAddress) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'Signature does not match public address',
      );
    }

    await User.getInstance().findByIdAndUpdate(user._id, {
      'metamask.nonce': uuid(),
    } as Query<User>);

    if (realmCtx) {
      // the scoped lookup guarantees realmCtx is the user's home realm
      const hasMembership = await RealmMembership.getInstance().findOne({
        user: String(user._id),
        realm: String(realmCtx.team._id),
      });
      if (!hasMembership) {
        await grantHomeMembership(this.grpcSdk, user, realmCtx);
      }
    }

    const config = ConfigController.getInstance().config;
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId: context.clientId,
      config,
      realm: realmIdOf(realmCtx),
    });
  }
}
