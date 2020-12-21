// todo Create the controller that creates REST-specific endpoints
import { Handler, IRouterMatcher, NextFunction, Request, Response, Router } from "express";
import {
  ConduitError,
  ConduitMiddleware,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteParameters,
} from "@quintessential-sft/conduit-sdk";
const swaggerUi = require("swagger-ui-express");

function extractRequestData(req: Request) {
  const context = (req as any).conduit;
  let params: any = {};
  let headers: any = req.headers;
  if (req.query) {
    Object.assign(params, req.query);
  }

  if (req.body) {
    Object.assign(params, req.body);
  }

  if (req.params) {
    Object.assign(params, req.params);
  }

  if (req.headers) {
    Object.assign(params, req.headers);
  }
  if (params.populate) {
    if (params.populate.includes(",")) {
      params.populate = params.populate.split(",");
    } else {
      params.populate = [params.populate];
    }
  }
  let path = req.baseUrl + req.path;
  return { context, params, headers, path };
}

export class RestController {
  private _router!: Router;
  private _middlewares?: { [field: string]: ConduitMiddleware[] };
  private _registeredRoutes: Map<string, Handler | ConduitRoute>;
  private _swaggerDoc: any;

  constructor() {
    this._registeredRoutes = new Map();
    this._swaggerDoc = {
      openapi: "3.0.0",
      info: {
        version: "1.0.0",
        title: "Conduit",
      },
      paths: {},
      components: {
        securitySchemes: {
          clientid: {
            type: "apiKey",
            in: "header",
            name: "clientid",
          },
          clientSecret: {
            type: "apiKey",
            in: "header",
            name: "clientSecret",
          },
          tokenAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    };
    this.initializeRouter();
  }

  handleRequest(req: Request, res: Response, next: NextFunction): void {
    this._router(req, res, next);
  }

  registerRoute(path: string, router: Router | ((req: Request, res: Response, next: NextFunction) => void)) {
    const key = `*-${path}`;
    const registered = this._registeredRoutes.has(key);
    this._registeredRoutes.set(key, router);
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
    if (!this._middlewares[middleware.name]) {
      this._middlewares[middleware.name] = [];
    }
    this._middlewares[middleware.name].push(middleware);
  }

  checkMiddlewares(params: ConduitRouteParameters, middlewares?: string[]): Promise<any> {
    let primaryPromise = new Promise((resolve, reject) => {
      resolve({});
    });
    if (this._middlewares && middlewares) {
      for (let k in this._middlewares) {
        if (!this._middlewares.hasOwnProperty(k)) continue;
        if (middlewares.indexOf(k) === 0) {
          this._middlewares[k].forEach((m) => {
            primaryPromise = primaryPromise.then((r) => {
              return m.executeRequest
                .bind(m)(params)
                .then((p: any) => {
                  if (p.result) {
                    Object.assign(r, JSON.parse(p.result));
                  }
                  return p;
                });
            });
          });
        }
      }
    }

    return primaryPromise;
  }

  private addRoute(path: string, router: Router | ((req: Request, res: Response, next: NextFunction) => void)) {
    this._router.use(path, router);
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
      self
        .checkMiddlewares(context, route.input.middlewares)
        .then((r) => {
          Object.assign(context.context, r);
          return route.executeRequest(context);
        })
        .then((r: any) => res.status(200).json(JSON.parse(r.result)))
        .catch((err: Error | ConduitError | any) => {
          if (err.hasOwnProperty("status")) {
            console.log(err);
            res.status((err as ConduitError).status).json({
              name: err.name,
              status: (err as ConduitError).status,
              message: err.message,
            });
          } else if (err.hasOwnProperty("code")) {
            let statusCode: number;
            let name: string;
            switch (err.code) {
              case 3:
                name = "INVALID_ARGUMENTS";
                statusCode = 400;
                break;
              case 5:
                name = "NOT_FOUND";
                statusCode = 404;
                break;
              case 7:
                name = "FORBIDDEN";
                statusCode = 403;
                break;
              case 16:
                name = "UNAUTHORIZED";
                statusCode = 401;
                break;
              default:
                name = "INTERNAL_SERVER_ERROR";
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
              name: "INTERNAL_SERVER_ERROR",
              status: 500,
              message: "Something went wrong",
            });
          }
        });
    });

    this.addRouteSwaggerDocumentation(route);
  }

  private addRouteSwaggerDocumentation(route: ConduitRoute) {
    let method = "";
    switch (route.input.action) {
      case ConduitRouteActions.GET: {
        method = "get";
        break;
      }
      case ConduitRouteActions.POST: {
        method = "post";
        break;
      }
      case ConduitRouteActions.DELETE: {
        method = "delete";
        break;
      }
      case ConduitRouteActions.UPDATE: {
        method = "put";
        break;
      }
      default: {
        method = "get";
      }
    }

    let routeDoc: any = {
      summary: route.input.description,
      parameters: [],
      responses: {},
      security: [
        {
          clientid: [],
          clientSecret: [],
        },
      ],
    };

    if (route.input.urlParams !== undefined) {
      for (const name in route.input.urlParams) {
        routeDoc.parameters.push({
          name,
          in: "path",
          required: true,
          type: route.input.urlParams[name],
        });
      }
    }

    if (route.input.queryParams !== undefined) {
      for (const name in route.input.queryParams) {
        routeDoc.parameters.push({
          name,
          in: "query",
          type: route.input.queryParams[name],
        });
      }
    }

    if (route.input.bodyParams !== undefined) {
      for (const name in route.input.bodyParams) {
        let type = "";
        if (typeof route.input.bodyParams[name] === "object") {
          // @ts-ignore
          if (route.input.bodyParams[name] && route.input.bodyParams[name].type && typeof route.input.bodyParams[name].type !== "object") {
            // @ts-ignore
            type = route.input.bodyParams[name].type.toLowerCase();
          } else {
            type = "object";
          }

          if (!["string", "number", "array", "object"].includes(type)) {
            type = "string";
          }
        } else {
          type = route.input.bodyParams[name].toString().toLowerCase();
        }
        routeDoc.parameters.push({
          name,
          in: "body",
          type,
        });
      }
    }

    if (route.input.middlewares?.includes("authMiddleware")) {
      routeDoc.security[0].tokenAuth = [];
    }

    let path = route.input.path.replace(/(:)(\w+)/g, "{$2}");
    if (this._swaggerDoc.paths.hasOwnProperty(path)) {
      this._swaggerDoc.paths[path][method] = routeDoc;
    } else {
      this._swaggerDoc.paths[path] = {};
      this._swaggerDoc.paths[path][method] = routeDoc;
    }
    this._swaggerDoc.paths[path] = { ...this._swaggerDoc.paths[path], method };
  }

  private refreshRouter() {
    this.initializeRouter();
    this._registeredRoutes.forEach((route, key) => {
      if (route instanceof ConduitRoute) {
        this.addConduitRoute(route);
      } else {
        const [method, path] = key.split("-");
        this.addRoute(path, route);
      }
    });
  }

  private initializeRouter() {
    this._router = Router();
    const self = this;
    this._router.use("/swagger", swaggerUi.serve);
    this._router.get("/swagger",(req,res,next) => swaggerUi.setup(self._swaggerDoc)(req,res,next));
    this._router.get("/swagger.json", (req, res) => {
      res.send(JSON.stringify(this._swaggerDoc));
    });
    this._router.use((req: Request, res: Response, next: NextFunction) => {
      next();
    });
  }
}
