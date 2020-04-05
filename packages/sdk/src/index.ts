import {Application} from "express";
import {ConduitSchema} from "./models/ConduitSchema";
import {TYPE} from "./interaces/Model";

export class ConduitSDK {

    private static _instance: ConduitSDK;
    private _app: Application;

    private constructor(app: Application) {
        this._app = app;
    }

    static getInstance(app: Application) {
        if (!this._instance && !app) throw new Error("No settings provided to initialize");
        if (!this._instance) {
            this._instance = new ConduitSDK(app);
        }
        return this._instance;
    }

}

export * from  "./models/ConduitSchema";
export * from  "./interaces/Model";


