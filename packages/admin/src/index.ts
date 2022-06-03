import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { ConduitRouteActions, GrpcCallback, GrpcRequest, GrpcServer } from '@conduitplatform/grpc-sdk';
import { RestController, SwaggerRouterMetadata } from '@conduitplatform/router';
import {
  ConduitCommons,
  ConduitRoute,
  ConduitMiddleware,
  ConduitSocket,
  IConduitAdmin,
  grpcToConduitRoute,
  RegisterAdminRouteRequest,
} from '@conduitplatform/commons';
import { hashPassword } from './utils/auth';
import { runMigrations } from './migrations';
import AdminConfigSchema from './config';
import * as middleware from './middleware';
import * as adminRoutes from './routes';
import * as models from './models';
import path from 'path';
import { RegisterAdminRouteRequest_PathDefinition } from '@conduitplatform/grpc-sdk/dist/protoUtils/core';

const swaggerRouterMetadata: SwaggerRouterMetadata = {
  urlPrefix: '/admin',
  securitySchemes: {
    masterKey: {
      name: 'masterkey',
      type: 'apiKey',
      in: 'header',
      description: 'Your administrative secret key, configurable through MASTER_KEY env var in Conduit Core',
    },
    adminToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'Bearer',
      description: 'An admin authentication token, retrievable through [POST] /admin/login',
    },
  },
  globalSecurityHeaders: [{
    masterKey: [],
  }],
  setExtraRouteHeaders(route: ConduitRoute, swaggerRouteDoc: any): void {
    if (route.input.path !== '/login' && route.input.path !== '/modules') {
      swaggerRouteDoc.security[0].adminToken = [];
    }
  },
};

export default class AdminModule extends IConduitAdmin {
  grpcSdk: ConduitGrpcSdk;
  private _restRouter: RestController;
  private _sdkRoutes: ConduitRoute[];
  private readonly _grpcRoutes: { [field: string]:  RegisterAdminRouteRequest_PathDefinition[] } = {};

  constructor(
    commons: ConduitCommons,
    grpcSdk: ConduitGrpcSdk,
  ) {
    super(commons);
    this.grpcSdk = grpcSdk;
    this._restRouter = new RestController(this.commons, swaggerRouterMetadata);

    // Register Middleware
    this._restRouter.registerRoute(
      '*',
      [
        middleware.getAdminMiddleware(this.commons),
        middleware.getAuthMiddleware(this.grpcSdk, this.commons),
      ],
    );

    this._grpcRoutes = {};
  }

  async initialize(server: GrpcServer) {
    await server.addService(
      path.resolve(__dirname, '../../core/src/core.proto'),
      'conduit.core.Admin',
      {
        registerAdminRoute: this.registerAdminRoute.bind(this),
      },
    );
    await this.commons
      .getConfigManager()
      .registerModulesConfig('admin', AdminConfigSchema.getProperties());
    await this.handleDatabase().catch(console.log);
    this._sdkRoutes = [
      adminRoutes.getLoginRoute(this.commons),
      adminRoutes.getModulesRoute(this.commons),
      adminRoutes.getCreateAdminRoute(this.commons),
      adminRoutes.getAdminUsersRoute(),
      adminRoutes.deleteAdminUserRoute(),
      adminRoutes.changePasswordRoute(this.commons),
    ];

    // Register Routes
    this._sdkRoutes.forEach((route) => {
      this._restRouter.registerConduitRoute(route);
    }, this);
    this.attachRouter();
    this.highAvailability().catch(() => {
      console.log('Failed to recover state');
    });
  }

  // grpc
  async registerAdminRoute(call: GrpcRequest<RegisterAdminRouteRequest>, callback: GrpcCallback<null>) {
    const moduleName = call.metadata!.get('module-name')[0];
    try {
      if (!call.request.routerUrl) {
        const result = this.commons
          .getConfigManager()!
          .getModuleUrlByName(call.metadata!.get('module-name')![0] as string);
        if (!result) {
          return callback({
            code: status.INTERNAL,
            message: 'Error when registering routes',
          });
        }
        call.request.routerUrl = result;
      }
      this.internalRegisterRoute(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl,
        moduleName as string,
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
    this.commons.getRouter().registerExpressRouter('/admin', (req, res, next) => {
      this._restRouter.handleRequest(req, res, next);
    });
  }

  private async highAvailability() {
    const r = await this.commons.getState().getKey('admin');
    if (!r || r.length === 0) {
      this.cleanupRoutes();
      return;
    }
    const state = JSON.parse(r);
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

    this.commons.getBus().subscribe('admin', (message: string) => {
      const messageParsed = JSON.parse(message);
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

  private updateState(protofile: string, routes: RegisterAdminRouteRequest_PathDefinition[], url: string) {
    this.commons
      .getState()
      .getKey('admin')
      .then((r: any) => {
        const state = !r || r.length === 0 ? {} : JSON.parse(r);
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
        return this.commons.getState().setKey('admin', JSON.stringify(state));
      })
      .then(() => {
        this.publishAdminRouteData(protofile, routes, url);
        console.log('Updated state');
      })
      .catch(() => {
        console.log('Failed to update state');
      });
  }

  private publishAdminRouteData(protofile: string, routes: RegisterAdminRouteRequest_PathDefinition[], url: string) {
    this.commons.getBus().publish(
      'admin',
      JSON.stringify({
        protofile,
        routes,
        url,
      }),
    );
  }

  private async handleDatabase() {
    if (!this.grpcSdk.database) {
      await this.grpcSdk.waitForExistence('database');
    }
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
    models.Admin.getInstance()
      .findOne({ username: 'admin' })
      .then(async (existing: any) => {
        if (isNil(existing)) {
          const adminConfig = await this.commons.getConfigManager().get('admin');
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
    routes: RegisterAdminRouteRequest_PathDefinition[],
    url: string,
    moduleName?: string,
  ) {
    const processedRoutes: (
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
      this.grpcSdk.grpcToken,
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
    const routes: { action: string; path: string }[] = [];
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
      const routesArray = this._grpcRoutes[grpcRoute];
      routes.push(
        ...routesArray.map((route: any) => {
          return { action: route.options.action, path: route.options.path };
        }),
      );
    });
    this._restRouter.cleanupRoutes(routes);
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model) => {
      const modelInstance = model.getInstance(this.grpcSdk.database!);
      return this.grpcSdk.database!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
}
