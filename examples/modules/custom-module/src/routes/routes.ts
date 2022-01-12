import ConduitGrpcSdk, {
  GrpcServer,
  RouteOptionType,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructConduitRoute,
  ConduitString,
  ConduitBoolean,
  ConduitNumber,
} from '@quintessential-sft/conduit-grpc-sdk';
import { CustomModuleHandlers } from '../handlers';
import { Foobar } from '../models';

export class CustomModuleRoutes {
  private readonly handlers: CustomModuleHandlers;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new CustomModuleHandlers();
    this.grpcSdk.router
      .registerRouterAsync(server, this.registeredRoutes, {
        getFoobar: this.handlers.getFoobar.bind(this.handlers),
        getFoobars: this.handlers.getFoobars.bind(this.handlers),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }

  get registeredRoutes(): any[] {
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
    ];
  }
}
