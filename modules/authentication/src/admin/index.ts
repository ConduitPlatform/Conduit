import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitDate,
  ConduitNumber,
  ConduitString,
  ConfigController,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { UserAdmin } from './user.js';
import { TeamsAdmin } from './team.js';
import { RealmsAdmin } from './realm.js';
import { SigningKeysAdmin, SigningKeysAdminDeps } from './signingKeys.js';
import { User } from '../models/index.js';
import { Config } from '../config/index.js';
import { errors } from '../errors.js';

export class AdminHandlers {
  private readonly userAdmin: UserAdmin;
  private readonly teamsAdmin: TeamsAdmin;
  private readonly realmsAdmin: RealmsAdmin;
  private readonly signingKeysAdmin: SigningKeysAdmin;
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    onRealmChange?: () => void,
    signingKeysDeps?: SigningKeysAdminDeps,
  ) {
    this.userAdmin = new UserAdmin(this.grpcSdk);
    this.teamsAdmin = new TeamsAdmin(this.grpcSdk);
    this.realmsAdmin = new RealmsAdmin(this.grpcSdk, onRealmChange);
    this.signingKeysAdmin = new SigningKeysAdmin(signingKeysDeps);
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  async registerAdminRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/users',
        action: ConduitRouteActions.GET,
        description: `Returns queried users and their total count.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
          isActive: ConduitBoolean.Optional,
          isAnonymous: ConduitBoolean.Optional,
          provider: ConduitString.Optional,
          homeRealm: ConduitString.Optional,
          realm: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetUsers', {
        users: [User.name],
        count: ConduitNumber.Required,
      }),
      this.userAdmin.getUsers.bind(this.userAdmin),
    );
    this.routingManager.route(
      {
        path: '/users',
        action: ConduitRouteActions.POST,
        description: `Creates a new user using email/username and password.`,
        bodyParams: {
          email: ConduitString.OptionalWith({ format: 'email' }),
          username: ConduitString.Optional,
          password: ConduitString.RequiredWith({ minLength: 8 }),
          homeRealm: ConduitString.Optional,
        },
        errors: [
          errors.USER_IDENTIFIER_INVALID,
          errors.USER_EMAIL_INVALID,
          errors.EMAIL_NOT_ALLOWED,
          errors.REALMS_DISABLED,
          errors.REALM_NOT_FOUND,
          errors.USER_EXISTS,
        ],
      },
      new ConduitRouteReturnDefinition(User.name),
      this.userAdmin.createUser.bind(this.userAdmin),
    );
    this.routingManager.route(
      {
        path: '/users/:id',
        action: ConduitRouteActions.PATCH,
        description: `Updates user's fields.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        bodyParams: {
          email: ConduitString.Optional,
          isVerified: ConduitBoolean.Optional,
          hasTwoFA: ConduitBoolean.Optional,
          phoneNumber: ConduitString.Optional,
          twoFaMethod: ConduitString.Optional,
        },
        errors: [
          errors.USER_NOT_FOUND,
          errors.PHONE_NUMBER_REQUIRED_FOR_2FA,
          errors.USER_EMAIL_TAKEN,
          errors.EMAIL_NOT_ALLOWED,
          errors.PHONE_NUMBER_TAKEN,
        ],
      },
      new ConduitRouteReturnDefinition('PatchUser', User.name),
      this.userAdmin.patchUser.bind(this.userAdmin),
    );
    this.routingManager.route(
      {
        path: '/users',
        action: ConduitRouteActions.DELETE,
        description: `Deletes queried users.`,
        queryParams: {
          ids: { type: [TYPE.String], required: true }, // handler array check is still required
        },
        errors: [errors.USER_IDS_REQUIRED, errors.USER_NOT_FOUND],
      },
      new ConduitRouteReturnDefinition('DeleteUsers', 'String'),
      this.userAdmin.deleteUsers.bind(this.userAdmin),
    );
    this.routingManager.route(
      {
        path: '/users/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a user.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        errors: [errors.USER_NOT_FOUND, errors.AUTHORIZATION_UNAVAILABLE],
      },
      new ConduitRouteReturnDefinition('DeleteUser', 'String'),
      this.userAdmin.deleteUser.bind(this.userAdmin),
    );
    this.routingManager.route(
      {
        path: '/users/:id/block',
        action: ConduitRouteActions.POST,
        description: `Blocks/inactivates a user.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        errors: [errors.USER_NOT_FOUND, errors.USER_ALREADY_BLOCKED],
      },
      new ConduitRouteReturnDefinition('BlockUser', 'String'),
      this.userAdmin.blockUser.bind(this.userAdmin),
    );
    this.routingManager.route(
      {
        path: '/users/:id/unblock',
        action: ConduitRouteActions.POST,
        description: `Unblocks/activates a user.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        errors: [errors.USER_NOT_FOUND, errors.USER_ALREADY_ACTIVE],
      },
      new ConduitRouteReturnDefinition('UnblockUser', 'String'),
      this.userAdmin.unblockUser.bind(this.userAdmin),
    );
    this.routingManager.route(
      {
        path: '/users/:id/realms',
        action: ConduitRouteActions.GET,
        description: `Returns the home realm and the guest realms of a user. Each guest realm carries when the user was linked into it.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        errors: [errors.USER_NOT_FOUND],
      },
      new ConduitRouteReturnDefinition('UserAdminRealms', {
        home: {
          type: {
            _id: ConduitString.Required,
            name: ConduitString.Required,
            slug: ConduitString.Required,
          },
          required: false,
        },
        guests: [
          {
            _id: ConduitString.Required,
            name: ConduitString.Required,
            slug: ConduitString.Required,
            createdAt: ConduitDate.Required,
          },
        ],
      }),
      this.userAdmin.getUserRealms.bind(this.userAdmin),
    );
    this.routingManager.route(
      {
        path: '/users/toggle',
        action: ConduitRouteActions.POST,
        description: `Blocks/unblocks queried users.`,
        bodyParams: {
          ids: { type: [TYPE.String], required: true }, // handler array check is still required
          block: ConduitBoolean.Required,
        },
        errors: [errors.USER_IDS_REQUIRED, errors.USER_NOT_FOUND],
      },
      new ConduitRouteReturnDefinition('ToggleUsers', 'String'),
      this.userAdmin.toggleUsers.bind(this.userAdmin),
    );

    this.signingKeysAdmin.declareRoutes(this.routingManager);

    const config: Config = ConfigController.getInstance().config;
    const teamsActivated =
      config.teams.enabled && this.grpcSdk.isAvailable('authorization');
    if (teamsActivated) {
      this.teamsAdmin.declareRoutes(this.routingManager);
      this.realmsAdmin.declareRoutes(this.routingManager);
    }

    return this.routingManager.registerRoutes().catch((err: Error) => {
      ConduitGrpcSdk.Logger.error('Failed to register admin routes for module');
      ConduitGrpcSdk.Logger.error(err);
    });
  }
}
