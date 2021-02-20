import path from "path";
import {ConduitModule} from "../../classes/ConduitModule";

export default class Authentication extends ConduitModule {

    constructor(url: string) {
        super(url);
        this.protoPath = path.resolve(__dirname, "../../proto/authentication.proto");
        this.descriptorObj = "authentication.Authentication";
        this.initializeClient();
    }

    setConfig(newConfig: any) {
        return new Promise((resolve, reject) => {
            this.client.setConfig({newConfig: JSON.stringify(newConfig)}, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || "Something went wrong");
                } else {
                    resolve(JSON.parse(res.updatedConfig));
                }
            });
        });
    }
}
