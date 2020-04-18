// todo create the controller that should construct both REST & GraphQL routes
import {Application, NextFunction, Request, Response, Router} from "express";
import {RestController} from "./Rest";
import {ConduitRoute, ConduitRouteParameters} from "@conduit/sdk";
import {GraphQLController} from "./GraphQl/GraphQL";

export class ConduitRoutingController {

    private _restRouter: RestController
    private _graphQLRouter?: GraphQLController
    private _graphQLRouting?: Router;
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
            if (req.url === '/graphql' && this._graphQLRouting) {
                this._graphQLRouting(req, res, next);
            } else if (req.url !== '/graphql') {
                // this needs to be a function to hook on whatever the current router is
                self._restRouter.handleRequest(req, res, next)
            }

        })
    }

    initGraphQL() {
        this._graphQLRouter = new GraphQLController(this._app);
        this._graphQLRouting = this._graphQLRouter?.getInternalRoute();
    }

    registerMiddleware(middleware: (req: Request, res: Response, next: NextFunction) => void) {
        this._middlewareRouter.use(middleware);
    }

    registerRouteMiddleware(path: string, middleware: (request: ConduitRouteParameters) => Promise<any>) {
        this._restRouter.registerMiddleware(path, middleware);
        this._graphQLRouter?.registerMiddleware(path, middleware);
    }

    registerRoute(path: string, router: Router | ((req: Request, res: Response, next: NextFunction) => void)) {
        this._restRouter.registerRoute(path, router);
    }

    registerConduitRoute(route: ConduitRoute) {
        this._graphQLRouter?.registerConduitRoute(route);
        this._restRouter.registerConduitRoute(route);
    }


}
