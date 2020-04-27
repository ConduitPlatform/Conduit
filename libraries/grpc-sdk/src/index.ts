import Config from "./config";


export default class ConduitGrpcSdk {

    private readonly serverUrl: string;
    private _config: any;

    constructor(serverUrl: string) {
        this.serverUrl = serverUrl;
    }

    loadDefinitions() {
        this._config = new Config(this.serverUrl);
    }

    get config() {
        return this._config;
    }

    get admin() {
        return this._config;
    }


}
