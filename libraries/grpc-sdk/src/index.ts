import Config from "./config";
import Admin from "./admin";
import Router from "./router";


export default class ConduitGrpcSdk {

    private readonly serverUrl: string;
    private readonly _config: Config;
    private readonly _admin: Admin;
    private readonly _router: Router;

    constructor(serverUrl: string) {
        this.serverUrl = serverUrl;
        this._config = new Config(this.serverUrl);
        this._admin = new Admin(this.serverUrl);
        this._router = new Router(this.serverUrl);
    }

    get config() {
        return this._config;
    }

    get admin() {
        return this._admin;
    }

    get router() {
        return this._router;
    }

}
