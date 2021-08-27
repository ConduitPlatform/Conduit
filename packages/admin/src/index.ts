import { isNil } from 'lodash';
import { hashPassword, verifyToken } from './utils/auth';
import { Handler, NextFunction, Request, Response, Router } from 'express';
import { AuthHandlers } from './handlers/auth';
import { AdminSchema } from './models/Admin';
import { ConduitCommons, IConduitAdmin } from '@quintessential-sft/conduit-commons';
import AdminConfigSchema from './config';
import fs from 'fs';
import path from 'path';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { loadPackageDefinition, Server, status, credentials } from '@grpc/grpc-js';

let protoLoader = require('@grpc/proto-loader');

let protoLoader = require('@grpc/proto-loader');

export default class AdminModule extends IConduitAdmin {
  conduit: ConduitCommons;
  grpcSdk: ConduitGrpcSdk;
  private router: Router;
  private adminHandlers: AuthHandlers;
  private _grpcRoutes: Record<string, { path: string; method: string }[]>;
  private _sdkRoutes: string[];
  private _registeredRoutes: Map<string, Handler>;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    conduit: ConduitCommons,
    server: Server,
    packageDefinition: any
  ) {
    super(conduit);
    this.conduit = conduit;
    this.grpcSdk = grpcSdk;
    this.router = Router();
    this._grpcRoutes = {};
    this._sdkRoutes = [];
    this._registeredRoutes = new Map();

    var protoDescriptor = loadPackageDefinition(packageDefinition);

    //grpc stuff
    // @ts-ignore
    let admin = protoDescriptor.conduit.core.Admin;
    server.addService(admin.service, {
      registerAdminRoute: this.registerAdminRoute.bind(this),
    });
  }

  async initialize() {
    await this.conduit
      .getConfigManager()
      .registerModulesConfig('admin', AdminConfigSchema.getProperties());
    await this.handleDatabase().catch(console.log);
    this.adminHandlers = new AuthHandlers(this.grpcSdk, this.conduit);
    const self = this;
    this.conduit
      .getRouter()
      .registerDirectRouter(
        '/admin/login',
        (req: Request, res: Response, next: NextFunction) =>
          self.adminHandlers.loginAdmin(req, res, next).catch(next)
      );
    this.conduit
      .getRouter()
      .registerDirectRouter(
        '/admin/modules',
        (req: Request, res: Response, next: NextFunction) => {
          let response: any[] = [];
          // this is used here as such, because the config manager is simply the config package
          // todo update the config manager interface so that we don't need these castings
          ((this.conduit.getConfigManager() as any).registeredModules as Map<
            string,
            string
          >).forEach((val: any, key: any) => {
            response.push(val);
          });
          res.json(response);
        }
      );

    // todo fix the middlewares
    //@ts-ignore

    this.conduit.getRouter().registerExpressRouter('/admin', (req, res, next) => {
      this.router(req, res, next);
    });
    this.highAvailability();
  }

  highAvailability() {
    const self = this;
    this.conduit
      .getState()
      .getKey('admin')
      .then((r) => {
        if (!r || r.length === 0) return;
        let state = JSON.parse(r);
        if (state.routes) {
          state.routes.forEach((r: any) => {
            self
              ._registerGprcRoute(r.protofile, r.routes, r.url)
              .then()
              .catch((err) => {
                console.log('Failed to register recovered route');
              });

            self._grpcRoutes[r.url] = r.routes;
          });
        }
      })
      .catch((err) => {
        console.log('Failed to recover state');
      });

    this.conduit.getBus().subscribe('admin', (message: string) => {
      let messageParsed = JSON.parse(message);
      self._grpcRoutes[messageParsed.url] = messageParsed.routes;

      self
        ._registerGprcRoute(
          messageParsed.protofile,
          messageParsed.routes,
          messageParsed.url
        )
        .then(() => {
          this.cleanupRoutes();
        });
    });
  }

  updateState(protofile: string, routes: any, url: string) {
    this.conduit
      .getState()
      .getKey('admin')
      .then((r) => {
        let state = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.routes) state.routes = [];
        state.routes.push({
          protofile,
          routes,
          url,
        });
        return this.conduit.getState().setKey('admin', JSON.stringify(state));
      })
      .then((r) => {
        this.publishAdminRouteData(protofile, routes, url);
        console.log('Updated state');
      })
      .catch((err) => {
        console.log('Failed to recover state');
      });
  }

  publishAdminRouteData(protofile: string, routes: any, url: string) {
    this.conduit.getBus().publish(
      'admin',
      JSON.stringify({
        protofile,
        routes,
        url,
      })
    );
  }

  findAdmin(object: any) {
    let value;
    const self = this;
    Object.keys(object).some(function (k) {
      if (k === 'Admin') {
        value = object[k];
        return true;
      }
      if (object[k] && typeof object[k] === 'object') {
        value = self.findAdmin(object[k]);
        return value !== undefined;
      }
    });
    return value;
  }

  //grpc
  async registerAdminRoute(call: any, callback: any) {
    let protofile = call.request.protoFile;
    let routes: [{ path: string; method: string; grpcFunction: string }] =
      call.request.routes;
    let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, protofile);
    var packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    let adminDescriptor: any = loadPackageDefinition(packageDefinition);
    adminDescriptor = this.findAdmin(adminDescriptor);
    if (!adminDescriptor) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Did not receive proper .proto file - missing Admin service',
      });
    }
    let error;
    let url = call.request.adminUrl;
    let moduleName = '';
    if (!url) {
      let result = this.conduit.getConfigManager().getModuleUrlByInstance(call.getPeer());
      if (!result) {
        return callback({
          code: status.INTERNAL,
          message: 'Error when registering routes',
        });
      }
      url = result.url;
      moduleName = result.moduleName;
      routes.forEach((r) => {
        // for backwards compatibility and fool-proofing
        if (r.path.startsWith(`/${moduleName}/`)) return;
        if (!r.path.startsWith(`/`)) r.path = `/${r.path}`;
        r.path = `/${moduleName}${r.path}`;
      });
    }
    let done = await this._registerGprcRoute(protofile, routes, url).catch(
      (err) => (error = err)
    );
    if (error) {
      callback({
        code: status.INTERNAL,
        message: 'Error when registering routes',
      });
    } else {
      this._grpcRoutes[url] = routes;
      this.cleanupRoutes();
      this.updateState(protofile, routes, url);
      callback(null, null);
    }
  }

  registerRoute(method: string, route: string, handler: Handler) {
    this._sdkRoutes.push(`${method}-${route}`);
    this._registerRoute(method, route, handler);
  }

  _registerRoute(method: string, route: string, handler: Handler) {
    const key = `${method}-${route}`;
    const registered = this._registeredRoutes.has(key);
    this._registeredRoutes.set(key, handler);
    if (registered) {
      this.refreshRouter();
    } else {
      switch (method) {
        case 'GET':
          this.router.get(route, handler);
          break;
        case 'POST':
          this.router.post(route, handler);
          break;
        case 'PUT':
          this.router.put(route, handler);
          break;
        case 'DELETE':
          this.router.delete(route, handler);
          break;
        default:
          this.router.get(route, handler);
      }
    }
  }

  async authMiddleware(req: Request, res: Response, next: NextFunction) {
    const databaseAdapter = await this.grpcSdk.databaseProvider!;
    const adminConfig = await this.conduit.getConfigManager().get('admin');

    const tokenHeader = req.headers.authorization;
    if (isNil(tokenHeader)) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const args = tokenHeader.split(' ');
    if (args.length !== 2) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const [prefix, token] = args;
    if (prefix !== 'JWT') {
      return res
        .status(401)
        .json({ error: 'The authorization header must begin with JWT' });
    }
    let decoded;
    try {
      decoded = verifyToken(token, adminConfig.auth.tokenSecret);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const { id } = decoded;

    databaseAdapter
      .findOne('Admin', { _id: id })
      .then((admin: any) => {
        if (isNil(admin)) {
          return res.status(401).json({ error: 'No such user exists' });
        }
        (req as any).admin = admin;
        next();
      })
      .catch((error: Error) => {
        console.log(error);
        res.status(500).json({ error: 'Something went wrong' });
      });
  }

  async adminMiddleware(req: Request, res: Response, next: NextFunction) {
    const adminConfig = await this.conduit.getConfigManager().get('admin');
    return new Promise((resolve, reject) => {
      const masterkey = req.headers.masterkey;
      if (isNil(masterkey) || masterkey !== adminConfig.auth.masterkey)
        return res.status(401).json({ error: 'Unauthorized' });
      next();
    });
  }

  // @ts-ignore
  private async handleDatabase() {
    if (!this.grpcSdk.databaseProvider) {
      await this.grpcSdk.waitForExistence('database-provider');
    }
    const databaseAdapter = this.grpcSdk.databaseProvider!;

    await databaseAdapter.createSchemaFromAdapter(AdminSchema);

    databaseAdapter
      .findOne('Admin', { username: 'admin' })
      .then(async (existing: any) => {
        if (isNil(existing)) {
          const adminConfig = await this.conduit.getConfigManager().get('admin');
          const hashRounds = adminConfig.auth.hashRounds;
          return hashPassword('admin', hashRounds);
        }
        return Promise.resolve(null);
      })
      .then((result: string | null) => {
        if (!isNil(result)) {
          return databaseAdapter.create('Admin', { username: 'admin', password: result });
        }
      })
      .catch(console.log);
  }

  private async _registerGprcRoute(adminProtofile: any, routes: any, serverIp: string) {
    let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, adminProtofile);
    var packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    let adminDescriptor: any = loadPackageDefinition(packageDefinition);
    adminDescriptor = this.findAdmin(adminDescriptor);

    let client = new adminDescriptor(serverIp, credentials.createInsecure(), {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    routes.forEach((r: any) => {
      let handler = (req: any, res: any, next: any) => {
        const context = (req as any).conduit;
        let params: any = {};
        if (req.query) {
          Object.assign(params, req.query);
        }
        if (req.body) {
          Object.assign(params, req.body);
        }
        if (req.params) {
          Object.assign(params, req.params);
        }
        if (params.populate) {
          if (params.populate.includes(',')) {
            params.populate = params.populate.split(',');
          } else {
            params.populate = [params.populate];
          }
        }
        let request = {
          params: JSON.stringify(params),
          header: JSON.stringify(req.headers),
          context: JSON.stringify(context),
        };
        client[r.grpcFunction](request, (err: any, result: any) => {
          if (err) {
            return res.status(500).send(err);
          }
          let sendResult = result.result;
          try {
            sendResult = JSON.parse(result.result);
          } catch (error) {
            // do nothing
          }
          res.status(200).json(sendResult);
        });
      };
      this._registerRoute(r.method, r.path, handler);
    });
  }

  private cleanupRoutes() {
    const self = this;
    let routes: { path: string; method: string }[] = [];
    Object.keys(this._grpcRoutes).forEach((grpcRoute: string) => {
      routes.push(...self._grpcRoutes[grpcRoute]);
    });

    let newRegisteredRoutes: Map<string, any> = new Map();
    routes.forEach((route: { path: string; method: string }) => {
      const key = `${route.method}-${route.path}`;
      if (self._registeredRoutes.has(key)) {
        newRegisteredRoutes.set(key, this._registeredRoutes.get(key));
      }
    });

    this._sdkRoutes.forEach((routeKey) => {
      if (self._registeredRoutes.has(routeKey)) {
        newRegisteredRoutes.set(routeKey, this._registeredRoutes.get(routeKey));
      }
    });

    this._registeredRoutes.clear();
    this._registeredRoutes = newRegisteredRoutes;
    this.refreshRouter();
  }

  private refreshRouter() {
    const self = this;
    this.router = Router();
    this.router.use((req, res, next) => this.adminMiddleware(req, res, next));
    this.router.use((req, res, next) => this.authMiddleware(req, res, next));
    this.router.post('/admin/create', (req: Request, res: Response, next: NextFunction) =>
      self.adminHandlers.createAdmin(req, res, next).catch(next)
    );
    this._registeredRoutes.forEach((route, key) => {
      const [method, path] = key.split('-');
      switch (method) {
        case 'GET':
          this.router.get(path, route);
          break;
        case 'POST':
          this.router.post(path, route);
          break;
        case 'PUT':
          this.router.put(path, route);
          break;
        case 'DELETE':
          this.router.delete(path, route);
          break;
        default:
          this.router.get(path, route);
      }
    });
  }
}
