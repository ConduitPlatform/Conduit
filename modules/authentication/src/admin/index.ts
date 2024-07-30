import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitNumber,
  ConduitString,
  ConfigController,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { UserAdmin } from './user.js';
import { ServiceAdmin } from './service.js';
import { TeamsAdmin } from './team.js';
import { Service, User } from '../models/index.js';
import { Config } from '../config/index.js';

export class AdminHandlers {
  private readonly userAdmin: UserAdmin;
  private readonly serviceAdmin: ServiceAdmin;
  private readonly teamsAdmin: TeamsAdmin;
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.userAdmin = new UserAdmin(this.grpcSdk);
    this.serviceAdmin = new ServiceAdmin(this.grpcSdk);
    this.teamsAdmin = new TeamsAdmin(this.grpcSdk);
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
          provider: ConduitString.Optional,
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
        description: `Creates a new user using email/password.`,
        bodyParams: {
          email: ConduitString.Required,
          password: ConduitString.Required,
        },
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
      },
      new ConduitRouteReturnDefinition('UnblockUser', 'String'),
      this.userAdmin.unblockUser.bind(this.userAdmin),
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
      },
      new ConduitRouteReturnDefinition('ToggleUsers', 'String'),
      this.userAdmin.toggleUsers.bind(this.userAdmin),
    );
    // Service Routes
    this.routingManager.route(
      {
        path: '/services',
        action: ConduitRouteActions.GET,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
        name: 'GetServices',
        description: 'Returns queried registered services.',
      },
      new ConduitRouteReturnDefinition('GetServices', {
        services: [Service.name],
        count: ConduitNumber.Required,
      }),
      this.serviceAdmin.getServices.bind(this.serviceAdmin),
    );
    this.routingManager.route(
      {
        path: '/services',
        action: ConduitRouteActions.POST,
        bodyParams: {
          name: ConduitString.Required,
        },
        name: 'CreateService',
        description: 'Registers a new service.',
      },
      new ConduitRouteReturnDefinition('CreateService', {
        name: ConduitString.Required,
        token: ConduitString.Required,
      }),
      this.serviceAdmin.createService.bind(this.serviceAdmin),
    );
    this.routingManager.route(
      {
        path: '/services/:id',
        action: ConduitRouteActions.DELETE,
        urlParams: {
          id: ConduitString.Required,
        },
        name: 'DeleteService',
        description: 'Deletes a service.',
      },
      new ConduitRouteReturnDefinition('DeleteService', 'String'),
      this.serviceAdmin.deleteService.bind(this.serviceAdmin),
    );
    this.routingManager.route(
      {
        path: '/services/:serviceId/token',
        action: ConduitRouteActions.GET,
        urlParams: {
          serviceId: ConduitString.Required,
        },
        name: 'RenewServiceToken',
        description: 'Renews a service token.',
      },
      new ConduitRouteReturnDefinition('RenewServiceToken', {
        name: ConduitString.Required,
        token: ConduitString.Required,
      }),
      this.serviceAdmin.renewToken.bind(this.serviceAdmin),
    );

    const config: Config = ConfigController.getInstance().config;
    const teamsActivated =
      config.teams.enabled && this.grpcSdk.isAvailable('authorization');
    if (teamsActivated) {
      this.teamsAdmin.declareRoutes(this.routingManager);
    }

    return this.routingManager.registerRoutes().catch((err: Error) => {
      ConduitGrpcSdk.Logger.error('Failed to register admin routes for module');
      ConduitGrpcSdk.Logger.error(err);
    });
  }
}
