import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { CustomEndpointHandler } from '../../handlers/CustomEndpoints/customEndpoint.handler';
import { ICustomEndpoint } from '../../interfaces';
import { DatabaseRoutes } from '../../routes/routes';
import { createCustomEndpointRoute } from './utils';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';

export class CustomEndpointController {
  private handler: CustomEndpointHandler;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private router: DatabaseRoutes,
  ) {
    this.handler = new CustomEndpointHandler(this.grpcSdk);
    this.refreshRoutes().catch(err => {
      console.log(err);
    });
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('database:customEndpoints:refresh', (message: string) => {
      this.refreshRoutes();
    });
  }

  refreshRoutes() {
    return this.database
      .getSchemaModel('CustomEndpoints')
      .model.findMany({ enabled: true })
      .then((r: ICustomEndpoint[]) => {
        if (!r || r.length == 0) {
          return console.log('No custom endpoints to register');
        }
        let routes: any[] = [];
        r.forEach((schema: ICustomEndpoint) => {
          routes.push(
            createCustomEndpointRoute(schema, this.handler.entryPoint.bind(this.handler)),
          );
          CustomEndpointHandler.addNewCustomOperationControl(schema);
        });

        this.router.addRoutes(routes, false);
        this.router.requestRefresh();
      })
      .catch((err: Error) => {
        console.error('Something went wrong when loading custom endpoints to the router');
        console.error(err);
      });
  }

  refreshEndpoints(): void {
    this.grpcSdk.bus?.publish('database:customEndpoints:refresh', '');
    this.refreshRoutes().then((r: any) => {
      console.log('Refreshed routes');
    });
  }
}
