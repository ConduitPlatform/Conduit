import {Application} from "express";
import {IConduitRouter} from "./modules/Router/interfaces";
import {IConduitDatabase} from "./modules/Database/interfaces/Database";

export class ConduitSDK {

    private static _instance: ConduitSDK;
    private _app: Application;
    private _router?: IConduitRouter;
    private _database?: IConduitDatabase;

    private constructor(app: Application) {
        this._app = app;
    }

    registerRouter(router: IConduitRouter) {
        if (this._router) throw new Error("Cannot register a second router!")
        this._router = router;
    }

    getRouter(): IConduitRouter {
        if (this._router) return this._router;
        throw new Error("Router not assigned yet!");
    }

    registerDatabase(database: IConduitDatabase) {
        if (this._database) throw new Error("Cannot register a second database!")
        this._database = database;
    }

    getDatabase(): IConduitDatabase {
        if (this._database) return this._database;
        throw new Error("Database not assigned yet!");
    }

    static getInstance(app: Application) {
        if (!this._instance && !app) throw new Error("No settings provided to initialize");
        if (!this._instance) {
            this._instance = new ConduitSDK(app);
        }
        return this._instance;
    }

}

export * from "./models";
export * from "./interaces";
export * from "./modules";


