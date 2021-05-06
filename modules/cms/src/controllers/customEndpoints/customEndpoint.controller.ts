import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { CustomEndpointHandler } from '../../handlers/CustomEndpoints/customEndpoint.handler';
import { CustomEndpoint } from '../../models/customEndpoint';
import { CmsRoutes } from '../../routes/Routes';
import { createCustomEndpointRoute } from './utils';
import schema from '../../models/customEndpoint.schema';
import { migrateCustomEndpoints } from '../../migrations/customEndpoint.schema.migrations';

export class CustomEndpointController {
  private _adapter: any;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private router: CmsRoutes,
    private readonly stateActive: boolean
  ) {
    this._adapter = this.grpcSdk.databaseProvider!;
    this._adapter.createSchemaFromAdapter(schema)
      .then(() => {
        console.log('Registered custom endpoints schema');
        return migrateCustomEndpoints(this.grpcSdk);
      })
      .then(() => {
        console.log('customEndpoints migration complete');
        this.refreshRoutes();
      })
      .catch((err: any) => {
        console.log(err);
      });
    if (stateActive) {
      this.initializeState();
    }
  }
  initializeState() {
    this.grpcSdk.bus?.subscribe('cms', (message: string) => {
      if (message === 'customEndpoint') {
        this.refreshRoutes();
      }
    });
  }

  refreshRoutes() {
    return this._adapter
      .findMany('CustomEndpoints', { enabled: true })
      .then((r: CustomEndpoint[]) => {
        if (!r || r.length == 0) {
          return console.log('No custom endpoints to register');
        }
        let routes: any[] = [];
        r.forEach((schema: CustomEndpoint) => {
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
    if (this.stateActive) {
      this.grpcSdk.bus?.publish('cms', 'customEndpoint');
    }
    this.refreshRoutes().then((r: any) => {
      console.log('Refreshed routes');
    });
  }
}
