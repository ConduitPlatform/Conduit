// todo create the controller that should construct both REST & GraphQL routes
import {Application, NextFunction, Request, Response, Router} from "express";

export class ConduitRoutingController {

    private _router: Router
    private _middlewareRouter: Router;

    constructor(app: Application) {
        this._router = Router();
        this._router.use((req: Request, res: Response, next: NextFunction) => {
            next();
        });
        this._middlewareRouter = Router();
        this._middlewareRouter.use((req: Request, res: Response, next: NextFunction) => {
            next();
        });

        const self = this;
        // this should be the only thing on your app
        app.use((req, res, next) => {
            self._middlewareRouter(req, res, next)
        })

        app.use((req, res, next) => {
            // this needs to be a function to hook on whatever the current router is
            if (self._router) {
                self._router(req, res, next)
            } else {
                next()
            }
        })
    }

    registerMiddleware(middleware: (req: Request, res: Response, next: NextFunction) => void) {
        this._middlewareRouter.use(middleware);
    }

    registerRoute(path: string, router: Router | ((req: Request, res: Response, next: NextFunction) => void)) {
        this._router.use(path, router);
    }


}
