import {Application} from "express";
import {IConduitRouter} from "./modules/Router/interfaces";
import {IConduitDatabase} from "./modules/Database/interfaces";
import {IConduitAdmin} from "./modules/Admin";
import { IConduitEmail } from './modules/Email';
import { IConduitPushNotifications } from './modules/PushNotifications';
import { IConduitInMemoryStore } from './modules/InMemoryStore';
import { IConduitStorage } from './modules/Storage';
import { IConduitSecurity } from './modules/Security';
import { IConduitAuthentication } from './modules/Authentication';

export class ConduitSDK {

    private static _instance: ConduitSDK;
    private _app: Application;
    private _router?: IConduitRouter;
    private _database?: IConduitDatabase;
    private _admin?: IConduitAdmin;
    private _email?: IConduitEmail;
    private _pushNotifications?: IConduitPushNotifications;
    private _inMemoryStore?: IConduitInMemoryStore;
    private _storage?: IConduitStorage;
    private _security?: IConduitSecurity;
    private _authentication?: IConduitAuthentication;

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

    registerEmail(email: IConduitEmail) {
        this._email = email;
    }

    getEmail() {
        if (this._email) return this._email;
        throw new Error('Email module not assigned yet!');
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

    registerInMemoryStore(inMemoryStore: IConduitInMemoryStore) {
        if (this._inMemoryStore) throw new Error('Cannot register a second in-memory-store module');
        this._inMemoryStore = inMemoryStore;
    }

    getInMemoryStore(): IConduitInMemoryStore {
        if (this._inMemoryStore) return this._inMemoryStore;
        throw new Error('In-memory-store module not assigned yet');
    }

    registerStorage(storage: IConduitStorage) {
        if (this._storage) throw new Error('Cannot register a second storage module');
        this._storage = storage;
    }

    getStorage(): IConduitStorage {
        if (this._storage) return this._storage;
        throw new Error('Storage module not assigned yet');
    }

    registerSecurity(security: IConduitSecurity) {
        if (this._security) throw new Error('Cannot register a second security module');
        this._security = security;
    }

    getSecurity(): IConduitSecurity {
        if (this._security) return this._security;
        throw new Error('Security module not assigned yet');
    }

    registerAuthentication(authentication: IConduitAuthentication) {
        if (this._authentication) throw new Error('Cannot register a second authentication module');
        this._authentication = authentication;
    }

    getAuthentication(): IConduitAuthentication {
        if (this._authentication) return this._authentication;
        throw new Error('Authentication module not assigned yet');
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
export * from './constants';


