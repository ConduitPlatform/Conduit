import { isNil } from 'lodash';
import { loadPackageDefinition, Server, status } from '@grpc/grpc-js';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { RestController } from '@conduitplatform/router';
import {
  ConduitCommons,
  ConduitRoute,
  ConduitMiddleware,
  ConduitSocket,
  IConduitAdmin,
  grpcToConduitRoute,
  ConduitRouteActions,
} from '@conduitplatform/commons';
import * as middleware from './middleware';
import * as adminRoutes from './routes';
import { hashPassword } from './utils/auth';
import AdminConfigSchema from './config';
import * as models from './models';

export default class AdminModule extends IConduitAdmin {
  private readonly conduitSdk: ConduitCommons;
  private readonly grpcSdk: ConduitGrpcSdk;
  private _restRouter: RestController;
  private _sdkRoutes: ConduitRoute[];
  private readonly _grpcRoutes: any = {};

  constructor(
    conduitSdk: ConduitCommons,
    grpcSdk: ConduitGrpcSdk,
    packageDefinition: any,
    server: Server,
  ) {
    super();
    this.conduitSdk = conduitSdk;
    this.grpcSdk = grpcSdk;
    this._restRouter = new RestController(this.conduitSdk);
    this._restRouter.registerRoute('*', middleware.getAdminMiddleware(this.conduitSdk));
    this._restRouter.registerRoute(
      '*',
      middleware.getAuthMiddleware(this.grpcSdk, this.conduitSdk),
    );
    // Register Pre-Auth-Middleware routes
    const preAuthMiddlewareRoutes: ConduitRoute[] = [];
    preAuthMiddlewareRoutes.push(adminRoutes.getLoginRoute(this.conduitSdk));
    preAuthMiddlewareRoutes.push(adminRoutes.getModulesRoute(this.conduitSdk));
    preAuthMiddlewareRoutes.forEach((route) => {
      this._restRouter.registerConduitRoute(route);
    }, this);

    this._grpcRoutes = {};
    this._sdkRoutes = [
      adminRoutes.getCreateAdminRoute(this.conduitSdk),
    ];

    // Register Post-Auth-Middleware routes
    this._sdkRoutes.forEach((route) => {
      this._restRouter.registerConduitRoute(route);
    }, this);

    let protoDescriptor = loadPackageDefinition(packageDefinition);

    // @ts-ignore
    let admin = protoDescriptor.conduit.core.Admin;
    server.addService(admin.service, {
      registerAdminRoute: this.registerAdminRoute.bind(this),
    });
  }

  async initialize() {
    await this.conduitSdk
      .getConfigManager()
      .registerModulesConfig('admin', AdminConfigSchema.getProperties());
    await this.handleDatabase().catch(console.log);
    this.attachRouter();
    this.highAvailability().catch(() => {
      console.log('Failed to recover state');
    });
  }

  // grpc
  async registerAdminRoute(call: any, callback: any) {
    const moduleName = call.metadata.get('module-name')[0];
    try {
      if (!call.request.routerUrl) {
        let result = this.conduitSdk
          .getConfigManager()!
          .getModuleUrlByName((call as any).metadata.get('module-name')[0]);
        if (!result) {
          return callback({
            code: status.INTERNAL,
            message: 'Error when registering routes',
          });
        }
        //(call as any).metadata.get('module-name')
        call.request.routerUrl = result;
      }
      this.internalRegisterRoute(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl,
        moduleName,
      );
      this.updateState(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl,
      );
    } catch (err) {
      console.error(err);
      return callback({
        code: status.INTERNAL,
        message: 'Error when registering routes',
      });
    }
    callback(null, null);
  }

  registerRoute(route: ConduitRoute): void {
    this._sdkRoutes.push(route);
    this._restRouter.registerConduitRoute(route);
    this.cleanupRoutes();
  }

  private attachRouter() {
    this.conduitSdk.getRouter().registerExpressRouter('/admin', (req, res, next) => {
      this._restRouter.handleRequest(req, res, next);
    });
  }

  private async highAvailability() {
    let r = await this.conduitSdk.getState().getKey('admin');
    if (!r || r.length === 0) {
      this.cleanupRoutes();
      return;
    }
    let state = JSON.parse(r);
    if (state.routes) {
      state.routes.forEach((r: any) => {
        try {
          this.internalRegisterRoute(r.protofile, r.routes, r.url);
        } catch (err) {
          console.error(err);
        }
      }, this);
      console.log('Recovered routes');
    }
    this.cleanupRoutes();

    this.conduitSdk.getBus().subscribe('admin', (message: string) => {
      let messageParsed = JSON.parse(message);
      try {
        this.internalRegisterRoute(
          messageParsed.protofile,
          messageParsed.routes,
          messageParsed.url,
        );
      } catch (err) {
        console.error(err);
      }
      this.cleanupRoutes();
    });
  }

  private updateState(protofile: string, routes: any, url: string) {
    this.conduitSdk
      .getState()
      .getKey('admin')
      .then((r: any) => {
        let state = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.routes) state.routes = [];
        let index;
        (state.routes as any[]).forEach((val, i) => {
          if (val.url === url) {
            index = i;
          }
        });
        if (index) {
          state.routes[index] = { protofile, routes, url };
        } else {
          state.routes.push({
            protofile,
            routes,
            url,
          });
        }
        return this.conduitSdk.getState().setKey('admin', JSON.stringify(state));
      })
      .then(() => {
        this.publishAdminRouteData(protofile, routes, url);
        console.log('Updated state');
      })
      .catch(() => {
        console.log('Failed to update state');
      });
  }

  private publishAdminRouteData(protofile: string, routes: any, url: string) {
    this.conduitSdk.getBus().publish(
      'admin',
      JSON.stringify({
        protofile,
        routes,
        url,
      }),
    );
  }

  private async handleDatabase() {
    if (!this.grpcSdk.databaseProvider) {
      await this.grpcSdk.waitForExistence('database');
    }
    await this.registerSchemas();
    models.Admin.getInstance()
      .findOne({ username: 'admin' })
      .then(async (existing: any) => {
        if (isNil(existing)) {
          const adminConfig = await this.conduitSdk.getConfigManager().get('admin');
          const hashRounds = adminConfig.auth.hashRounds;
          return hashPassword('admin', hashRounds);
        }
        return Promise.resolve(null);
      })
      .then((result: string | null) => {
        if (!isNil(result)) {
          return models.Admin.getInstance().create({ username: 'admin', password: result });
        }
      })
      .catch(console.log);
  }

  private internalRegisterRoute(
    protofile: any,
    routes: any[],
    url: any,
    moduleName?: string,
  ) {
    let processedRoutes: (
      | ConduitRoute
      | ConduitMiddleware
      | ConduitSocket // can go
      )[] = grpcToConduitRoute(
      'Admin',
      {
        protoFile: protofile,
        routes: routes,
        routerUrl: url,
      },
      moduleName,
    );

    processedRoutes.forEach((r) => {
      if (r instanceof ConduitRoute) {
        console.log(
          'New admin route registered: ' +
          r.input.action +
          ' ' +
          r.input.path +
          ' handler url: ' +
          url,
        );
        this._restRouter.registerConduitRoute(r);
      }
    });
    this._grpcRoutes[url] = routes;
    this.cleanupRoutes();
  }

  private cleanupRoutes() {
    let routes: { action: string; path: string }[] = [];
    // Admin routes
    routes.push(
      { action: ConduitRouteActions.POST, path: '/login' },
      { action: ConduitRouteActions.GET, path: '/modules' },
    );
    // Package routes
    this._sdkRoutes.forEach((route: ConduitRoute) => {
      routes.push({ action: route.input.action, path: route.input.path });
    });
    // Module routes
    Object.keys(this._grpcRoutes).forEach((grpcRoute: string) => {
      let routesArray = this._grpcRoutes[grpcRoute];
      routes.push(
        ...routesArray.map((route: any) => {
          return { action: route.options.action, path: route.options.path };
        }),
      );
    });
    this._restRouter.cleanupRoutes(routes);
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
      let modelInstance = model.getInstance(this.grpcSdk.databaseProvider!);
      return this.grpcSdk.databaseProvider!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
}
