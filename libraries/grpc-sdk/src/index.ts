import Config from "./config";
import Admin from "./admin";


export default class ConduitGrpcSdk {

    private readonly serverUrl: string;
    private readonly _config: Config;
    private readonly _admin: Admin;

    constructor(serverUrl: string) {
        this.serverUrl = serverUrl;
        this._config = new Config(this.serverUrl);
        this._admin = new Admin(this.serverUrl);
    }

    get config() {
        return this._config;
    }

    get admin() {
        return this._admin;
    }


}
