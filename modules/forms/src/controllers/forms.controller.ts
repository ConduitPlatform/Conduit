import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  RoutingManager,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { Forms } from '../models';
import { FormsRoutes } from '../routes';

export class FormsController {
  private router: FormsRoutes;
  private routingManager: RoutingManager;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
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

  setRouter(router: FormsRoutes) {
    this.router = router;
    this.routingManager = router._routingManager;
    this.refreshRoutes();
  }

  refreshRoutes() {
    if (!this.router) {
      return;
    }
    Forms.getInstance()
      .findMany({ enabled: true })
      .then((r: Forms[]) => {
        this._registerRoutes(r);
        this.router.requestRefresh();
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error(
          'Something went wrong when loading forms for forms module',
        );
        ConduitGrpcSdk.Logger.error(err);
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
          description: `Submits form with id ${r._id}.`,
          bodyParams: r.fields,
        },
        new ConduitRouteReturnDefinition(`SubmitForm${r.name}`, 'String'),
        this.router.submitForm.bind(this.router),
      );
    });
  }
}
