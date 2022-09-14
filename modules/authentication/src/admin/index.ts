import ConduitGrpcSdk, {
  GrpcServer,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  RouteOptionType,
  TYPE,
  ConduitString,
  ConduitNumber,
  ConduitBoolean,
  ConduitRouteObject,
  constructConduitRoute,
} from '@conduitplatform/grpc-sdk';
import { UserAdmin } from './user';
import { ServiceAdmin } from './service';
import { User, Service } from '../models';

export class AdminHandlers {
  private readonly userAdmin: UserAdmin;
  private readonly serviceAdmin: ServiceAdmin;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.userAdmin = new UserAdmin(this.grpcSdk);
    this.serviceAdmin = new ServiceAdmin(this.grpcSdk);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getUsers: this.userAdmin.getUsers.bind(this),
        createUser: this.userAdmin.createUser.bind(this),
        patchUser: this.userAdmin.patchUser.bind(this),
        deleteUser: this.userAdmin.deleteUser.bind(this),
        deleteUsers: this.userAdmin.deleteUsers.bind(this),
        toggleUsers: this.userAdmin.toggleUsers.bind(this),
        blockUser: this.userAdmin.blockUser.bind(this),
        unblockUser: this.userAdmin.unblockUser.bind(this),
        getServices: this.serviceAdmin.getServices.bind(this),
        createService: this.serviceAdmin.createService.bind(this),
        deleteService: this.serviceAdmin.deleteService.bind(this),
        renewServiceToken: this.serviceAdmin.renewToken.bind(this),
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.log('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [
      // User Routes
      constructConduitRoute(
        {
          path: '/users',
          action: ConduitRouteActions.GET,
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
          users: ['User'],
          count: ConduitNumber.Required,
        }),
        'getUsers',
      ),
      constructConduitRoute(
        {
          path: '/users',
          action: ConduitRouteActions.POST,
          bodyParams: {
            email: ConduitString.Required,
            password: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('User'),
        'createUser',
      ),
      constructConduitRoute(
        {
          path: '/users/:id',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            email: ConduitString.Optional,
            isVerified: ConduitBoolean.Optional,
            hasTwoFA: ConduitBoolean.Optional,
            phoneNumber: ConduitString.Optional,
            twoFaMethod: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('PatchUser', 'User'),
        'patchUser',
      ),
      constructConduitRoute(
        {
          path: '/users',
          action: ConduitRouteActions.DELETE,
          queryParams: {
            ids: { type: [TYPE.String], required: true }, // handler array check is still required
          },
        },
        new ConduitRouteReturnDefinition('DeleteUsers', 'String'),
        'deleteUsers',
      ),
      constructConduitRoute(
        {
          path: '/users/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteUser', 'String'),
        'deleteUser',
      ),
      constructConduitRoute(
        {
          path: '/users/:id/block',
          action: ConduitRouteActions.POST,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('BlockUser', 'String'),
        'blockUser',
      ),
      constructConduitRoute(
        {
          path: '/users/:id/unblock',
          action: ConduitRouteActions.POST,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('UnblockUser', 'String'),
        'unblockUser',
      ),
      constructConduitRoute(
        {
          path: '/users/toggle',
          action: ConduitRouteActions.POST,
          bodyParams: {
            ids: { type: [TYPE.String], required: true }, // handler array check is still required
            block: ConduitBoolean.Required,
          },
        },
        new ConduitRouteReturnDefinition('ToggleUsers', 'String'),
        'toggleUsers',
      ),
      // Service Routes
      constructConduitRoute(
        {
          path: '/services',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            sort: ConduitString.Optional,
          },
          name: 'GetServices',
          description: 'Returns registered services',
        },
        new ConduitRouteReturnDefinition('GetServices', {
          services: ['Service'],
          count: ConduitNumber.Required,
        }),
        'getServices',
      ),
      constructConduitRoute(
        {
          path: '/services',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
          },
          name: 'CreateService',
          description: 'Registers a new service',
        },
        new ConduitRouteReturnDefinition('CreateService', {
          name: ConduitString.Required,
          token: ConduitString.Required,
        }),
        'createService',
      ),
      constructConduitRoute(
        {
          path: '/services/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: ConduitString.Required,
          },
          name: 'DeleteService',
          description: 'Deletes a service',
        },
        new ConduitRouteReturnDefinition('DeleteService', 'String'),
        'deleteService',
      ),
      constructConduitRoute(
        {
          path: '/services/:serviceId/token',
          action: ConduitRouteActions.GET,
          urlParams: {
            serviceId: ConduitString.Required,
          },
          name: 'RenewServiceToken',
          description: 'Renews a service token',
        },
        new ConduitRouteReturnDefinition('RenewServiceToken', {
          name: ConduitString.Required,
          token: ConduitString.Required,
        }),
        'renewServiceToken',
      ),
    ];
  }
}
