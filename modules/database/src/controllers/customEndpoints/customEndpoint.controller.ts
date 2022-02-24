import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { CustomEndpointHandler } from '../../handlers/CustomEndpoints/customEndpoint.handler';
import { ICustomEndpoint } from '../../models/CustomEndpoint.interface';
import { CmsRoutes } from '../../routes/routes';
import { createCustomEndpointRoute } from './utils';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';

export class CustomEndpointController {

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private router: CmsRoutes,
  ) {
    this.refreshRoutes()
      .catch((err: any) => {
        console.log(err);
      });
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('cms', (message: string) => {
      if (message === 'customEndpoint') {
        this.refreshRoutes();
      }
    });
  }

  refreshRoutes() {
    return this.database.getSchemaModel('CustomEndpoints').model
      .findMany({ enabled: true })
      .then((r: ICustomEndpoint[]) => {
        if (!r || r.length == 0) {
          return console.log('No custom endpoints to register');
        }
        let routes: any[] = [];
        r.forEach((schema: ICustomEndpoint) => {
          routes.push(createCustomEndpointRoute(schema));
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
    this.grpcSdk.bus?.publish('cms', 'customEndpoint');
    this.refreshRoutes().then((r: any) => {
      console.log('Refreshed routes');
    });
  }
}
