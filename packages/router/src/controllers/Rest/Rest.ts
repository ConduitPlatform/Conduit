// todo Create the controller that creates REST-specific endpoints
import {
  Application,
  Handler,
  IRouterMatcher,
  NextFunction,
  Request,
  Response,
  Router,
} from 'express';
import {
  ConduitCommons,
  ConduitError,
  ConduitMiddleware,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteParameters,
} from '@quintessential-sft/conduit-commons';
import { SwaggerGenerator } from './Swagger';
import { extractRequestData, validateParams } from './util';
import { createHashKey, extractCaching } from '../cache.utils';

const swaggerUi = require('swagger-ui-express');
const crypto = require('crypto');

export class RestController {
  private _router!: Router;
  private _middlewares?: { [field: string]: ConduitMiddleware };
  private _registeredRoutes: Map<string, ConduitRoute>;
  private _registeredLocalRoutes: Map<string, Handler>;
  private _swagger: SwaggerGenerator;

  constructor(private readonly app: Application) {
    this._registeredRoutes = new Map();
    this._registeredLocalRoutes = new Map();
    this._swagger = new SwaggerGenerator();
    this.initializeRouter();
  }

  handleRequest(req: Request, res: Response, next: NextFunction): void {
    this._router(req, res, next);
  }

  cleanupRoutes(routes: any[]) {
    let newRegisteredRoutes: Map<string, ConduitRoute> = new Map();
    routes.forEach((route: any) => {
      let key = `${route.action}-${route.path}`;
      if (this._registeredRoutes.has(key)) {
        newRegisteredRoutes.set(key, this._registeredRoutes.get(key)!);
      }
    });

    this._registeredRoutes.clear();
    this._registeredRoutes = newRegisteredRoutes;
    this.refreshRouter();
  }

  registerRoute(
    path: string,
    router: Router | ((req: Request, res: Response, next: NextFunction) => void)
  ) {
    const key = `*-${path}`;
    const registered = this._registeredLocalRoutes.has(key);
    this._registeredLocalRoutes.set(key, router);
    if (registered) {
      this.refreshRouter();
    } else {
      this.addRoute(path, router);
    }
  }

  registerConduitRoute(route: ConduitRoute) {
    const key = `${route.input.action}-${route.input.path}`;
    const registered = this._registeredRoutes.has(key);
    this._registeredRoutes.set(key, route);
    // If the route has been registered, then we need to reinitialize the router so the actual routes change
    if (registered) {
      this.refreshRouter();
    } else {
      this.addConduitRoute(route);
    }
  }

  registerMiddleware(middleware: ConduitMiddleware) {
    if (!this._middlewares) {
      this._middlewares = {};
    }
    this._middlewares[middleware.name] = middleware;
  }

  checkMiddlewares(params: ConduitRouteParameters, middlewares?: string[]): Promise<any> {
    let primaryPromise = new Promise((resolve, reject) => {
      resolve({});
    });
    const self = this;
    if (this._middlewares && middlewares) {
      middlewares.forEach((m) => {
        if (!this._middlewares?.hasOwnProperty(m))
          primaryPromise = Promise.reject('Middleware does not exist');
        primaryPromise = primaryPromise.then((r) => {
          return this._middlewares![m].executeRequest.bind(self._middlewares![m])(
            params
          ).then((p: any) => {
            if (p.result) {
              Object.assign(r, JSON.parse(p.result));
            }
            return r;
          });
        });
      });
    }

    return primaryPromise;
  }

  private addRoute(
    path: string,
    router: Router | ((req: Request, res: Response, next: NextFunction) => void)
  ) {
    this._router.use(path, router);
  }

  private findInCache(hashKey: string) {
    return ((this.app as any).conduit as ConduitCommons)
      .getState()
      .getKey('hash-' + hashKey);
  }

  private storeInCache(hashKey: string, data: any, cacheAge: number) {
    ((this.app as any).conduit as ConduitCommons)
      .getState()
      .setKey('hash-' + hashKey, JSON.stringify(data), cacheAge * 1000);
  }

  private addConduitRoute(route: ConduitRoute) {
    const self = this;
    let routerMethod: IRouterMatcher<Router>;

    switch (route.input.action) {
      case ConduitRouteActions.GET: {
        routerMethod = this._router.get.bind(this._router);
        break;
      }
      case ConduitRouteActions.POST: {
        routerMethod = this._router.post.bind(this._router);
        break;
      }
      case ConduitRouteActions.DELETE: {
        routerMethod = this._router.delete.bind(this._router);
        break;
      }
      case ConduitRouteActions.UPDATE: {
        routerMethod = this._router.put.bind(this._router);
        break;
      }
      default: {
        routerMethod = this._router.get.bind(this._router);
      }
    }

    routerMethod(route.input.path, (req, res, next) => {
      let context = extractRequestData(req);
      let hashKey: string;
      let { caching, cacheAge, scope } = extractCaching(
        route,
        req.headers['cache-control']
      );
      self
        .checkMiddlewares(context, route.input.middlewares)
        .then((r) => {
          validateParams(context.params, {
            ...route.input.bodyParams,
            ...route.input.queryParams,
            ...route.input.urlParams,
          });
          return r;
        })
        .then((r) => {
          Object.assign(context.context, r);
          if (route.input.action !== ConduitRouteActions.GET) {
            return route.executeRequest(context);
          }
          if (caching) {
            hashKey = createHashKey(context.path, context.context, context.params);
            return this.findInCache(hashKey)
              .then((r) => {
                if (r) {
                  return { fromCache: true, data: JSON.parse(r) };
                } else {
                  return route.executeRequest(context);
                }
              })
              .catch(() => {
                return route.executeRequest(context);
              });
          } else {
            return route.executeRequest(context);
          }
        })
        .then((r: any) => {
          if (r.redirect) {
            res.removeHeader('Authorization');
            res.removeHeader('authorization');
            res.removeHeader('clientid');
            res.removeHeader('clientsecret');
            return res.redirect(r.redirect);
          } else {
            let result;
            if (r.fromCache) {
              return res.status(200).json(r.data);
            } else {
              result = r.result ? r.result : r;
            }
            if (r.result && !(typeof route.returnTypeFields === 'string')) {
              result = JSON.parse(result);
            } else {
              result = { result: result };
            }
            if (route.input.action === ConduitRouteActions.GET && caching) {
              this.storeInCache(hashKey, result, cacheAge!);
              res.setHeader('Cache-Control', `${scope}, max-age=${cacheAge}`);
            } else {
              res.setHeader('Cache-Control', 'no-store');
            }

            res.status(200).json(result);
          }
        })
        .catch((err: Error | ConduitError | any) => {
          if (err.hasOwnProperty('status')) {
            console.log(err);
            res.status((err as ConduitError).status).json({
              name: err.name,
              status: (err as ConduitError).status,
              message: err.message,
            });
          } else if (err.hasOwnProperty('code')) {
            let statusCode: number;
            let name: string;
            switch (err.code) {
              case 3:
                name = 'INVALID_ARGUMENTS';
                statusCode = 400;
                break;
              case 5:
                name = 'NOT_FOUND';
                statusCode = 404;
                break;
              case 7:
                name = 'FORBIDDEN';
                statusCode = 403;
                break;
              case 16:
                name = 'UNAUTHORIZED';
                statusCode = 401;
                break;
              default:
                name = 'INTERNAL_SERVER_ERROR';
                statusCode = 500;
            }
            res.status(statusCode).json({
              name,
              status: statusCode,
              message: err.details,
            });
          } else {
            console.log(err);
            res.status(500).json({
              name: 'INTERNAL_SERVER_ERROR',
              status: 500,
              message: 'Something went wrong',
            });
          }
        });
    });

    this._swagger.addRouteSwaggerDocumentation(route);
  }

  private refreshRouter() {
    this.initializeRouter();
    this._registeredLocalRoutes.forEach((route, key) => {
      const [method, path] = key.split('-');
      this.addRoute(path, route);
    });
    this._registeredRoutes.forEach((route, key) => {
      this.addConduitRoute(route);
    });
  }

  private initializeRouter() {
    this._router = Router();
    const self = this;
    this._router.use('/swagger', swaggerUi.serve);
    this._router.get('/swagger', (req, res, next) =>
      swaggerUi.setup(self._swagger.swaggerDoc)(req, res, next)
    );
    this._router.get('/swagger.json', (req, res) => {
      res.send(JSON.stringify(this._swagger.swaggerDoc));
    });
    this._router.use((req: Request, res: Response, next: NextFunction) => {
      next();
    });
  }
}
