import { ConduitCommons } from '@conduitplatform/commons';
import { ConduitRouteActions as Actions } from '@conduitplatform/grpc-sdk';
import { Core } from '../Core';
import { ConduitLogger } from '../utils/logger';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export class HttpServer {
  private router: any;
  private readonly logger: ConduitLogger;

  constructor(private readonly commons: ConduitCommons) {
    this.logger = new ConduitLogger();
  }

  initialize() {
    // this.router = this.commons.getRouter();
    this.registerRoutes();
  }

  private registerRoutes() {
    this.router.registerRoute(
      new ConduitRoute(
        {
          path: '/',
          action: Actions.GET,
        },
        new ConduitRouteReturnDefinition('HelloResult', 'String'),
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
        new ConduitRouteReturnDefinition('HealthResult', 'String'),
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
