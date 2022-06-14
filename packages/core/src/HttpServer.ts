import {
  ConduitRoute,
  ConduitRouteReturnDefinition as ReturnDefinition,
  ConduitCommons,
  IConduitRouter,
} from '@conduitplatform/commons';
import { ConduitRouteActions as Actions } from '@conduitplatform/grpc-sdk';
import { Core } from './Core';
import { ConduitLogger } from './utils/logging/logger';

export class HttpServer {
  private _initialized: boolean = false;
  private router: IConduitRouter;
  private readonly logger: ConduitLogger;

  get initialized() {
    return this._initialized;
  }

  constructor(private readonly commons: ConduitCommons) {
    this.logger = new ConduitLogger();
  }

  initialize() {
    this.router = this.commons.getRouter();
    this.registerRoutes();
    this._initialized = true;
  }

  private registerRoutes() {
    this.router.registerRoute(
      new ConduitRoute(
        {
          path: '/',
          action: Actions.GET,
        },
        new ReturnDefinition('HelloResult', 'String'),
        async () => {
          return 'Hello there!';
        },
      ),
    );

    this.router.registerRoute(
      new ConduitRoute(
        {
          path: '/health',
          action: Actions.GET,
          queryParams: {
            shouldCheck: 'String',
          },
        },
        new ReturnDefinition('HealthResult', 'String'),
        () => {
          return new Promise(resolve => {
            if (Core.getInstance().initialized) {
              resolve('Conduit is online!');
            } else {
              throw new Error('Conduit is not active yet!');
            }
          });
        },
      ),
    );
  }
}
