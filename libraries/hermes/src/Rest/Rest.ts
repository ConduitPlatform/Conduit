import {
  Handler,
  IRouterMatcher,
  NextFunction,
  Request,
  Response,
  Router,
} from 'express';
import { SwaggerGenerator } from './Swagger.js';
import { extractRequestData, mapGrpcErrorToHttp, validateParams } from './util.js';
import { createHashKey, extractCaching } from '../cache.utils.js';
import { ConduitRouter } from '../Router.js';
import {
  ConduitError,
  ConduitGrpcSdk,
  ConduitRouteActions,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { Cookie } from '../interfaces/index.js';
import { SwaggerRouterMetadata } from '../types/index.js';
import { ConduitRoute, TypeRegistry } from '../classes/index.js';
import { apiReference } from '@scalar/express-api-reference';

import swaggerUi from 'swagger-ui-express';

export class RestController extends ConduitRouter {
  private _privateHeaders: string[];
  private _registeredLocalRoutes: Map<string, Handler | Handler[]>;
  private _swagger?: SwaggerGenerator;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    getSwaggerRouterMetadata: () => SwaggerRouterMetadata = () => ({
      servers: [],
      urlPrefix: '',
      securitySchemes: {},
      globalSecurityHeaders: [],
      setExtraRouteHeaders: () => {},
    }),
    private readonly metrics?: {
      registeredRoutes?: {
        name: string;
      };
    },
  ) {
    super(grpcSdk);
    this._registeredLocalRoutes = new Map();
    this._swagger = new SwaggerGenerator(getSwaggerRouterMetadata);
    this.initializeRouter();
    TypeRegistry.getInstance(grpcSdk, {
      name: 'rest',
      updateHandler: this._swagger.updateSchemaType.bind(this._swagger),
    });
  }

  registerRoute(
    path: string,
    router:
      | Router
      | ((req: Request, res: Response, next: NextFunction) => void)
      | ((req: Request, res: Response, next: NextFunction) => void)[],
  ) {
    const key = `*-${path}`;
    const registered = this._registeredLocalRoutes.has(key);
    this._registeredLocalRoutes.set(key, router);
    if (registered) {
      this.refreshRouter();
    } else {
      this.addRoute(path, router);
      if (this.metrics?.registeredRoutes) {
        ConduitGrpcSdk.Metrics?.increment(this.metrics.registeredRoutes.name, 1, {
          transport: 'rest',
        });
      }
    }
  }

  registerConduitRoute(route: ConduitRoute) {
    if (!this.routeChanged(route)) return;
    const key = `${route.input.action}-${route.input.path}`;
    const registered = this._registeredRoutes.has(key);
    this._registeredRoutes.set(key, route);
    if (!registered) {
      this.addConduitRoute(route);
      if (this.metrics?.registeredRoutes) {
        ConduitGrpcSdk.Metrics?.increment(this.metrics.registeredRoutes.name, 1, {
          transport: 'rest',
        });
      }
    }
  }

  private extractResult(returnTypeFields: string, result: any) {
    switch (returnTypeFields) {
      case TYPE.JSON:
        return JSON.parse(result);
      default:
        return result;
    }
  }

  private addRoute(
    path: string,
    router:
      | Router
      | ((req: Request, res: Response, next: NextFunction) => void)
      | ((req: Request, res: Response, next: NextFunction) => void)[],
  ) {
    this._expressRouter!.use(path, router);
  }

  private addConduitRoute(route: ConduitRoute) {
    let routerMethod: IRouterMatcher<Router>;
    switch (route.input.action) {
      case ConduitRouteActions.GET: {
        routerMethod = this._expressRouter!.get.bind(this._expressRouter);
        break;
      }
      case ConduitRouteActions.POST: {
        routerMethod = this._expressRouter!.post.bind(this._expressRouter);
        break;
      }
      case ConduitRouteActions.DELETE: {
        routerMethod = this._expressRouter!.delete.bind(this._expressRouter);
        break;
      }
      case ConduitRouteActions.UPDATE: {
        routerMethod = this._expressRouter!.put.bind(this._expressRouter);
        break;
      }
      case ConduitRouteActions.PATCH: {
        routerMethod = this._expressRouter!.patch.bind(this._expressRouter);
        break;
      }
      default: {
        routerMethod = this._expressRouter!.get.bind(this._expressRouter);
      }
    }
    routerMethod(route.input.path, this.constructHandler(route));
    this._swagger!.addRouteSwaggerDocumentation(route);
  }

  constructHandler(route: ConduitRoute): (req: Request, res: Response) => void {
    const self = this;
    return (req, res) => {
      const context = { ...extractRequestData(req), params: {} };
      let hashKey: string;
      const { caching, cacheAge, scope } = extractCaching(
        route,
        req.headers['cache-control'],
      );
      if (route.input.bodyParams)
        validateParams(context.bodyParams, route.input.bodyParams);
      if (route.input.queryParams)
        validateParams(context.queryParams, route.input.queryParams);
      if (route.input.urlParams) validateParams(context.urlParams, route.input.urlParams);
      context.params = {
        ...context.bodyParams,
        ...context.queryParams,
        ...context.urlParams,
      };
      self
        .checkMiddlewares(context, route.input.middlewares)
        .then(() => {
          if (route.input.action !== ConduitRouteActions.GET) {
            return route.executeRequest(context);
          }
          if (caching) {
            hashKey = createHashKey(context.path, context.context, context.params);
            return this.findInCache(hashKey)
              .then(r => {
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
        .then(r => {
          if (r.setCookies && r.setCookies.length) {
            r.setCookies.forEach((cookie: Cookie) => {
              if (cookie.options.path === '') delete cookie.options.path;
              if (!cookie.options.domain || cookie.options.domain === '') {
                delete cookie.options.domain;
              }
              res.cookie(cookie.name, cookie.value, cookie.options);
            });
          }
          if (r.removeCookies && r.removeCookies.length) {
            r.removeCookies.forEach((cookie: Cookie) => {
              if (cookie.options.path === '') delete cookie.options.path;
              if (!cookie.options.domain || cookie.options.domain === '') {
                delete cookie.options.domain;
              }
              res.clearCookie(cookie.name, cookie.options);
            });
          }
          if (r.redirect) {
            res.removeHeader('Authorization');
            this._privateHeaders.forEach(h => res.removeHeader(h));
            return res.redirect(r.redirect);
          } else {
            let result;
            if (r.fromCache) {
              return res.status(200).json(r.data);
            } else {
              result = r.result ?? r;
            }
            try {
              // Handle gRPC route responses
              result = JSON.parse(result);
            } catch {
              if (typeof result === 'string') {
                // Nest plain string responses
                result = {
                  result: this.extractResult(route.returnTypeFields as string, result),
                };
              }
            }
            delete result.setCookies;
            delete result.removeCookies;
            if (route.input.action === ConduitRouteActions.GET && caching) {
              this.storeInCache(hashKey, result, cacheAge!);
              res.setHeader('Cache-Control', `${scope}, max-age=${cacheAge}`);
            } else {
              res.setHeader('Cache-Control', 'no-store');
            }
            res.status(200).json(result);
            res.end();
          }
        })
        .catch(this.handleError(res));
    };
  }

  handleError(res: Response): (err: Error | ConduitError) => void {
    return (err: Error | ConduitError | any) => {
      if (err.hasOwnProperty('status')) {
        ConduitGrpcSdk.Logger.error(err);
        return res.status((err as ConduitError).status).json({
          name: err.name,
          status: (err as ConduitError).status,
          message: err.message,
        });
      }
      if (err.hasOwnProperty('code')) {
        const { status, name } = mapGrpcErrorToHttp(err.code);
        let parsed: { message: string; conduitCode: string } | null = null;
        try {
          parsed = JSON.parse(err.details);
        } catch (e) {
          // The below line is commented out to avoid cluttering the logs since most errors will not have a parsable details field.
          // console.warn('Error parsing details:', e);
        }
        if (parsed && typeof parsed === 'object') {
          ConduitGrpcSdk.Logger.error(parsed.message);
          return res.status(status).json({
            name,
            status,
            message: parsed.message,
            conduitCode: parsed.conduitCode,
          });
        } else {
          ConduitGrpcSdk.Logger.error(err);
          return res.status(status).json({
            name,
            status,
            message: err.details,
          });
        }
      }
      ConduitGrpcSdk.Logger.error(err);
      res.status(500).json({
        name: 'INTERNAL_SERVER_ERROR',
        status: 500,
        message: 'Something went wrong',
      });
    };
  }

  protected _refreshRouter() {
    this.initializeRouter();
    this._swagger?.cleanup();
    this._registeredLocalRoutes.forEach((route, key) => {
      const [_, path] = key.split('-');
      this.addRoute(path, route);
    });
    this._registeredRoutes.forEach(route => {
      this.addConduitRoute(route);
    });
    this._swagger?.importDbTypes();
  }

  private initializeRouter() {
    const swaggerRouterMetadata = this._swagger?.getSwaggerRouterMetadata();
    if (swaggerRouterMetadata) {
      this._privateHeaders =
        swaggerRouterMetadata.globalSecurityHeaders.length > 0
          ? Object.keys(swaggerRouterMetadata.globalSecurityHeaders[0] ?? {})
          : [];
    }
    this.createRouter();
    const self = this;
    this._expressRouter!.use('/swagger', swaggerUi.serve);
    this._expressRouter!.get('/swagger', (req, res, next) =>
      swaggerUi.setup(self._swagger!.swaggerDoc)(req, res, next),
    );

    this._expressRouter!.use(
      '/reference',
      apiReference({
        sources: [
          {
            url: '/swagger.json',
            default: true,
          },
        ],
      }),
    );
    this._expressRouter!.get('/swagger.json', (req, res) => {
      res.send(JSON.stringify(this._swagger!.swaggerDoc));
    });
    this._expressRouter!.use((req: Request, res: Response, next: NextFunction) => {
      next();
    });
  }

  shutDown() {
    TypeRegistry.removeTransport('rest');
    super.shutDown();
    this._registeredLocalRoutes.clear();
    delete this._swagger;
  }
}
