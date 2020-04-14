// todo Create the controller that creates REST-specific endpoints
import {NextFunction, Request, Response, Router} from "express";
import {ConduitRoute, ConduitRouteParameters} from "@conduit/sdk";
import {ConduitError} from "@conduit/sdk";

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
        this._router.use(route.input.path, (req, res, next) => {
            let context = extractRequestData(req)
            self.checkMiddlewares(route.input.path, context)
                .then(r => route.executeRequest(context))
                .then((r: any) => res.status(200).json(r))
                .catch((err: Error | ConduitError) => {
                    if (err.hasOwnProperty("status")) {
                        res.status((err as ConduitError).status).json({err});
                    } else {
                        // TODO This is temporary until we fix rest error response
                        console.log(err);
                        res.status(500).json({err});
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
