// todo Create the controller that creates REST-specific endpoints
import {NextFunction, Request, Response, Router} from "express";
import {ConduitRoute} from "@conduit/sdk";

function extractRequestData(req: Request) {

    const context = (req as any).conduit;
    let params: any = {}
    if (req.query) {
        Object.assign(params, req.query);
    }

    if (req.body) {
        Object.assign(params, req.body);
    }

    if (req.params) {
        Object.assign(params, req.params);
    }
    let path = req.path;
    return {context, params, path}

}

export class RestController {

    private readonly _router: Router

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
        this._router.use(route.input.path, (req, res, next) => {
            route.executeRequest(extractRequestData(req))
                .then((r: any) => {
                    res.status(200).json(r);
                })
                .catch((err: any) => {
                    res.status(500).json({err});
                })
        })
    }


}
