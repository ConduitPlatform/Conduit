// todo create the controller that should construct both REST & GraphQL routes
import {Application, NextFunction, Request, Response, Router} from "express";
import {RestController} from "./Rest";
import {GraphQLController} from "./GraphQL";
import {ConduitRoute} from "@conduit/sdk";

export class ConduitRoutingController {

    private _restRouter: RestController
    private _graphQLRouter?: GraphQLController
    private _app: Application
    private _middlewareRouter: Router;

    constructor(app: Application) {
        this._app = app;
        this._restRouter = new RestController();
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
            self._restRouter.handleRequest(req, res, next)
        })
    }

    initGraphQL() {
        this._graphQLRouter = new GraphQLController(this._app);
    }

    registerMiddleware(middleware: (req: Request, res: Response, next: NextFunction) => void) {
        this._middlewareRouter.use(middleware);
    }

    registerRoute(path: string, router: Router | ((req: Request, res: Response, next: NextFunction) => void)) {
        this._restRouter.registerRoute(path, router);
    }

    registerConduitRoute(route: ConduitRoute) {
        this._graphQLRouter?.registerConduitRoute(route);
        this._restRouter.registerConduitRoute(route);
    }


}
