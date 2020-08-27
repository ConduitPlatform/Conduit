import schema from './models/schema';
import {AdminHandlers} from './admin/admin';
import ConduitGrpcSdk, {ConduitSchema, grpcModule} from '@quintessential-sft/conduit-grpc-sdk';
import path from "path";
import {CmsRoutes} from './routes/Routes';
import {SchemaController} from "./controllers/schema.controller";

let protoLoader = require('@grpc/proto-loader');

export class CMS {

    private _adapter: any;
    // @ts-ignore
    private _admin: AdminHandlers;/**/
    private _url: string;
    private readonly grpcServer: any;
    private schemaController: SchemaController | undefined;
    private _routes: any[] | null = null;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        const packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './cms.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        const protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

        const cms = protoDescriptor.cms.CMS;
        this.grpcServer = new grpcModule.Server();
        // this.grpcServer.addService(cms.service, {});

        this._url = process.env.SERVICE_URL || '0.0.0.0:0';
        let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure());
        this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
        const self = this;

        this.grpcSdk.waitForExistence('database-provider')
            .then(() => {
                self._adapter = self.grpcSdk.databaseProvider!;
                let consumerRoutes = new CmsRoutes(self.grpcServer, self.grpcSdk, self.url);
                self.schemaController = new SchemaController(self.grpcSdk, consumerRoutes);
                self._admin = new AdminHandlers(self.grpcServer, self.grpcSdk, self.schemaController!);
                console.log("bound on:", self._url);
                self.grpcServer.start();
            }).catch(console.log);
    }


    get routes() {
        return this._routes;
    }

    get url(): string {
        return this._url;
    }


}



