import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  RoutingManager,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { Forms } from '../models';
import { FormsRoutes } from '../routes';

export class FormsController {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: FormsRoutes,
    private readonly routingManager: RoutingManager,
  ) {
    this.refreshRoutes();
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('forms', (message: string) => {
      if (message === 'form') {
        this.refreshRoutes();
      }
    });
  }

  refreshRoutes() {
    Forms.getInstance()
      .findMany({ enabled: true })
      .then((r: Forms[]) => {
        this._registerRoutes(r);
        this.router.requestRefresh();
      })
      .catch((err: Error) => {
        console.error('Something went wrong when loading forms for forms module');
        console.error(err);
      });
  }

  private _registerRoutes(forms: Forms[]) {
    this.routingManager.clear();
    forms.forEach((r: Forms) => {
      Object.keys(r.fields).forEach(key => {
        r.fields[key] = TYPE.String;
      });
      this.routingManager.route(
        {
          path: `/${r._id}`,
          action: ConduitRouteActions.POST,
          bodyParams: r.fields,
        },
        new ConduitRouteReturnDefinition(`SubmitForm${r.name}`, 'String'),
        this.router.submitForm.bind(this.router),
      );
    });
  }
}
