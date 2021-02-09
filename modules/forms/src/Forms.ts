import * as models from "./models";
import {AdminHandlers} from "./admin/admin";
import FormsConfigSchema from "./config";
import {isNil} from "lodash";
import ConduitGrpcSdk, {grpcModule} from "@quintessential-sft/conduit-grpc-sdk";
import path from "path";
import * as grpc from "grpc";
import {FormRoutes} from "./routes/Routes";
import {FormsController} from "./controllers/forms.controller";
import {FormSubmissionTemplate} from "./templates";

let protoLoader = require("@grpc/proto-loader");

export default class FormsModule {
    private database: any;
    private _admin: AdminHandlers;
    private isRunning: boolean = false;
    private _url: string;
    private _router: FormRoutes;
    private _formController: FormsController;
    private readonly grpcServer: any;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        const packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "./forms.proto"), {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        const protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

        const forms = protoDescriptor.forms.Forms;
        this.grpcServer = new grpcModule.Server();

        this.grpcServer.addService(forms.service, {
            setConfig: this.setConfig.bind(this),
        });

        this._url = process.env.SERVICE_URL || "0.0.0.0:0";
        let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure(), {
            "grpc.max_receive_message_length": 1024 * 1024 * 100,
            "grpc.max_send_message_length": 1024 * 1024 * 100
        });
        this._url = process.env.SERVICE_URL || "0.0.0.0:" + result;
        console.log("bound on:", this._url);

        this.grpcSdk
            .waitForExistence("database-provider")
            .then(() => {
                return this.grpcSdk.waitForExistence("email")
            })
            .then(() => {
                return this.grpcSdk.initializeEventBus();
            })
            .then(() => {
                const self = this;
                this.grpcSdk.bus?.subscribe("forms", (message: string) => {
                    if (message === "config-update") {
                        this.enableModule()
                            .then((r) => {
                                console.log("Updated forms configuration");
                            })
                            .catch((e: Error) => {
                                console.log("Failed to update forms config");
                            });
                    }
                });
                this.grpcSdk.bus?.subscribe("email-provider", (message: string) => {
                    if (message === "enabled") {
                        this.enableModule()
                            .then((r) => {
                                console.log("Updated forms configuration");
                            })
                            .catch((e: Error) => {
                                console.log("Failed to update forms config");
                            });
                    }
                });
            })
            .catch(() => {
                console.log("Bus did not initialize!");
            })
            .then(() => {
                return this.grpcSdk.config.get("forms");
            })
            .catch(() => {
                return this.grpcSdk.config.updateConfig(FormsConfigSchema.getProperties(), "forms");
            })
            .then((authConfig: any) => {
                return this.grpcSdk.config.addFieldstoConfig(FormsConfigSchema.getProperties(), "forms");
            })
            .catch(() => {
                console.log("forms config did not update");
            })
            .then((formsConfig: any) => {
                if (formsConfig.active) {
                    return this.enableModule();
                }
            })
            .catch(console.log);
    }

    get url(): string {
        return this._url;
    }

    async setConfig(call: any, callback: any) {
        const newConfig = JSON.parse(call.request.newConfig);
        if (!FormsConfigSchema.load(newConfig).validate()) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: "Invalid configuration values"});
        }

        let errorMessage: string | null = null;
        const updateResult = await this.grpcSdk.config
            .updateConfig(newConfig, "forms")
            .catch((e: Error) => (errorMessage = e.message));
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        const formsConfig = await this.grpcSdk.config.get("forms");
        if (formsConfig.active) {
            await this.enableModule().catch((e: Error) => (errorMessage = e.message));
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
            this.grpcSdk.bus?.publish("forms", "config-update");
        } else {
            return callback({code: grpc.status.FAILED_PRECONDITION, message: "Module is not active"});
        }
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        return callback(null, {updatedConfig: JSON.stringify(updateResult)});
    }

    private async enableModule() {
        let url = this._url;
        if (process.env.REGISTER_NAME === "true") {
            url = "forms:" + this._url.split(":")[1];
        }
        if (!this.isRunning) {
            this.database = this.grpcSdk.databaseProvider;
            this._router = new FormRoutes(this.grpcServer, this.grpcSdk, url);
            this._formController = new FormsController(this.grpcSdk, this._router);
            this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk, this._formController);
            await this.registerSchemas();
            await this.grpcSdk.emailProvider!.registerTemplate(FormSubmissionTemplate);
            this.grpcServer.start();
            this.isRunning = true;
        }

    }

    private registerSchemas() {
        const promises = Object.values(models).map((model) => {
            return this.database.createSchemaFromAdapter(model);
        });
        return Promise.all(promises);
    }
}
