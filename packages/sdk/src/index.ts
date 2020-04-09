import {Application} from "express";
import {IConduitRouter} from "./modules/Router/interfaces";
import {IConduitDatabase} from "./modules/Database/interfaces/Database";
import {IConduitAdmin} from "./modules/Admin/ConduitAdmin";
import { IConduitPushNotifications } from './modules/PushNotifications';

export class ConduitSDK {

    private static _instance: ConduitSDK;
    private _app: Application;
    private _router?: IConduitRouter;
    private _database?: IConduitDatabase;
    private _admin?: IConduitAdmin;
    private _pushNotifications?: IConduitPushNotifications;

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

    registerAdmin(admin: IConduitAdmin) {
        if (this._admin) throw new Error("Cannot register a second admin!")
        this._admin = admin;
    }

    getAdmin(): IConduitAdmin {
        if (this._admin) return this._admin;
        throw new Error("Admin not assigned yet!");
    }

    registerPushNotifications(pushNotifications: IConduitPushNotifications) {
        if (this._pushNotifications) throw new Error('Cannot register a second push notifications module');
        this._pushNotifications = pushNotifications;
    }

    // TODO is this needed?
    getPushNotifications(): IConduitPushNotifications {
        if (this._pushNotifications) return this._pushNotifications;
        throw new Error("Push notifications not assigned yet!");
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


