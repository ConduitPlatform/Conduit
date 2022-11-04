import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { CustomEndpointHandler } from '../../handlers/CustomEndpoints/customEndpoint.handler';
import { PopulatedCustomEndpoint } from '../../interfaces';
import { DatabaseRoutes } from '../../routes';
import { createCustomEndpointRoute } from './utils';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';

export class CustomEndpointController {
  private handler: CustomEndpointHandler;
  private router: DatabaseRoutes;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {
    this.handler = new CustomEndpointHandler(database);
    this.refreshRoutes();
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('database:customEndpoints:refresh', (message: string) => {
      this.refreshRoutes();
    });
  }

  setRouter(router: DatabaseRoutes) {
    this.router = router;
    this.refreshRoutes();
  }

  refreshRoutes() {
    if (!this.router) {
      return;
    }
    return this.database
      .getSchemaModel('CustomEndpoints')
      .model.findMany({ enabled: true }, undefined, undefined, undefined, undefined, [
        'selectedSchema',
      ])
      .then((r: PopulatedCustomEndpoint[]) => {
        if (!r || r.length == 0) {
          ConduitGrpcSdk.Logger.log('No custom endpoints to register');
        }
        const routes: any[] = [];
        r.forEach(endpoint => {
          routes.push(
            createCustomEndpointRoute(
              endpoint,
              this.handler.entryPoint.bind(this.handler),
            ),
          );
          CustomEndpointHandler.addNewCustomOperationControl(endpoint);
        });

        this.router!.addRoutes(routes, false);
        this.router!.requestRefresh();
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log('Refreshed routes');
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error(
          'Something went wrong when loading custom endpoints to the router',
        );
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  refreshEndpoints(): void {
    this.grpcSdk.bus?.publish('database:customEndpoints:refresh', '');
    this.refreshRoutes();
  }
}
