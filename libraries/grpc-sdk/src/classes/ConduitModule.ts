import {createGrpcClient} from "../helpers";

export class ConduitModule {

    protected client: any;
    protected readonly _url: string;
    protected protoPath?: string;
    protected descriptorObj?: string;
    active: boolean = false;

    constructor(url: string) {
        this._url = url;
    }

    initializeClient() {
        if (this.client) return;
        this.client = createGrpcClient(this._url, this.protoPath!, this.descriptorObj!);
        this.active = true;
    }

    closeConnection() {
        this.client.close();
        this.client = null;
        this.active = false;
    }
}
