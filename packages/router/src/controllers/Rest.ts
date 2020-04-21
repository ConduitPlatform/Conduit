// todo Create the controller that creates REST-specific endpoints
import { IRouterMatcher, NextFunction, Request, Response, Router } from 'express';
import { ConduitError, ConduitRoute, ConduitRouteActions, ConduitRouteParameters } from '@conduit/sdk';

function extractRequestData(req: Request) {

    const context = (req as any).conduit;
    let params: any = {}
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
    if (params.populate) {
        if (params.populate.includes(',')) {
            params.populate = params.populate.split(',');
        } else {
            params.populate = [params.populate];
        }
    }
    let path = req.baseUrl + req.path;
    return {context, params, headers, path}

}

export class RestController {

    private readonly _router: Router
    private _middlewares?: { [field: string]: ((request: ConduitRouteParameters) => Promise<any>)[] };

    constructor() {
        this._router = Router();
        this._router.use((req: Request, res: Response, next: NextFunction) => {
            next();
        });
    }

    handleRequest(req: Request, res: Response, next: NextFunction): void {
        this._router(req, res, next);
    }

    registerRoute(path: string, router: Router | ((req: Request, res: Response, next: NextFunction) => void)) {
        this._router.use(path, router);
    }

    registerConduitRoute(route: ConduitRoute) {
        const self = this;

        let routerMethod: IRouterMatcher<Router>;

        switch(route.input.action) {
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
            let context = extractRequestData(req)
            self.checkMiddlewares(route.input.path, context)
                .then(r => route.executeRequest(context))
                .then((r: any) => res.status(200).json(r))
                .catch((err: Error | ConduitError) => {
                    if (err.hasOwnProperty("status")) {
                        console.log(err);
                        res.status((err as ConduitError).status).json({
                            name: err.name,
                            status: (err as ConduitError).status,
                            message: err.message,
                        });
                    } else {
                        console.log(err);
                        res.status(500).json({
                            name: 'INTERNAL_SERVER_ERROR',
                            status: 500,
                            message: 'Something went wrong'
                        });
                    }

                })
        })
    }

    registerMiddleware(path: string, middleware: (request: ConduitRouteParameters) => Promise<any>) {
        if (!this._middlewares) {
            this._middlewares = {};
        }
        if (!this._middlewares[path]) {
            this._middlewares[path] = [];
        }
        this._middlewares[path].push(middleware);
    }

    checkMiddlewares(path: string, params: ConduitRouteParameters): Promise<any> {
        let primaryPromise = new Promise((resolve, reject) => {
            resolve();
        })
        if (this._middlewares) {
            for (let k in this._middlewares) {
                if (!this._middlewares.hasOwnProperty(k)) continue;
                if (path.indexOf(k) === 0) {
                    this._middlewares[k].forEach(m => {
                        primaryPromise = primaryPromise.then(r => m(params));
                    })
                }
            }
        }

        return primaryPromise
    }
}
