import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  RouteOptionType,
  ConduitString,
  ConduitNumber,
  ConduitBoolean,
  TYPE
} from '@quintessential-sft/conduit-grpc-sdk';
import { AdminHandlers } from './handlers';
import { Foobar } from '../models';

export class AdminRoutes {
  private readonly handlers: AdminHandlers;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.handlers = new AdminHandlers(this.grpcSdk);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getFoobar: this.handlers.getFoobar.bind(this),
        getFoobars: this.handlers.getFoobars.bind(this),
        createFoobar: this.handlers.createFoobar.bind(this),
        patchFoobar: this.handlers.patchFoobar.bind(this),
        updateFoobar: this.handlers.updateFoobar.bind(this),
        deleteFoobar: this.handlers.deleteFoobar.bind(this),
        deleteFoobars: this.handlers.deleteFoobars.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private getRegisteredRoutes(): any[] {
    // NOTICE:
    // Admin routes are registered under /admin/$moduleName/$path
    return [
      constructConduitRoute(
        {
          path: '/foobars/:id',
          action: ConduitRouteActions.GET,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('GetFoobar', Foobar.getInstance().fields),
        'getFoobar'
      ),
      constructConduitRoute(
        {
          path: '/foobars',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
            sort: ConduitString.Optional,
            enabled: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetFoobars', {
          foobars: [Foobar.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getFoobars'
      ),
      constructConduitRoute(
        {
          path: '/foobars',
          action: ConduitRouteActions.POST,
          bodyParams: {
            foo: ConduitBoolean.Required,
            bar: ConduitString.Optional,
            userId: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('CreateFoobar', Foobar.getInstance().fields),
        'createFoobar'
      ),
      constructConduitRoute(
        {
          path: '/foobars/:id',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            foo: ConduitBoolean.Optional,
            bar: ConduitString.Optional,
            userId: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('PatchFoobar', Foobar.getInstance().fields),
        'patchFoobar'
      ),
      constructConduitRoute(
        {
          path: '/foobars/:id',
          action: ConduitRouteActions.UPDATE, // PUT
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            foo: ConduitBoolean.Required,
            bar: ConduitString.Optional,
            userId: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('UpdateFoobar', Foobar.getInstance().fields),
        'updateFoobar'
      ),
      constructConduitRoute(
        {
          path: '/foobars/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteFoobar', 'String'),
        'deleteFoobar'
      ),
      constructConduitRoute(
        {
          path: '/foobars',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            ids: { type: [TYPE.JSON], required: true }, // handler array check is required
          },
        },
        new ConduitRouteReturnDefinition('DeleteFoobars', {
          foobars: [Foobar.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'deleteFoobars'
      ),
    ];
  }
}
