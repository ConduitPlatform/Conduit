import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructRoute,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { Forms } from '../models';
import { FormsRoutes } from '../routes/routes';

export class FormsController {

  constructor(private readonly grpcSdk: ConduitGrpcSdk, private router: FormsRoutes) {
    this.loadExistingForms();
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('forms', (message: string) => {
      if (message === 'form') {
        this.refreshRoutes();
      }
    });
  }

  private async loadExistingForms() {
    Forms.getInstance()
      .findMany({ enabled: true })
      .then((r: any) => {
        this._registerRoutes(r);
        this.router.requestRefresh();
      })
      .catch((err: Error) => {
        console.error('Something went wrong when loading forms for forms module');
        console.error(err);
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
    let routesArray: any = [];
    forms.forEach((r: Forms) => {
      Object.keys(r.fields).forEach((key) => {
        r.fields[key] = TYPE.String;
      });
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: `/${r._id}`,
              action: ConduitRouteActions.POST,
              bodyParams: r.fields,
            },
            new ConduitRouteReturnDefinition(`SubmitForm${r.name}`, 'String'),
            'submitForm'
          )
        )
      );
    });
    this.router.addRoutes(routesArray);
  }
}
