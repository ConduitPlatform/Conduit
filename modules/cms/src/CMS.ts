import schema from './models/schema';
import {AdminHandlers} from './admin/admin';
import {isNil} from 'lodash';
import ConduitGrpcSdk, {ConduitSchema, grpcModule} from '@conduit/grpc-sdk';
import path from "path";
import {CmsRoutes} from './routes/Routes';

let protoLoader = require('@grpc/proto-loader');

export class CMS {

    private _adapter: any;
    // @ts-ignore
    private _admin: AdminHandlers;
    private _schemas: { [name: string]: any } = {}; // used to be SchemaAdapter
    private readonly _router: any;
    private _url: string;
    private readonly grpcServer: any;
    private _routes: any[];

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

        let consumerRoutes = new CmsRoutes(this.grpcServer, this.grpcSdk);
        this._routes = consumerRoutes.registeredRoutes;

        this._url = process.env.SERVICE_URL || '0.0.0.0:0';
        let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure());
        this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
        console.log("bound on:", this._url);
        this.grpcServer.start();

        this.grpcSdk.waitForExistence('database-provider')
            .then(() => {
                this._adapter = this.grpcSdk.databaseProvider!;
                this._schemas['SchemaDefinitions'] = this._adapter.createSchemaFromAdapter(schema);
                this.loadExistingSchemas();
                this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk, this.createSchema.bind(this));
            }).catch(console.log);
    }

    private loadExistingSchemas() {
        this._adapter
            .findMany('SchemaDefinitions', {enabled: true})
            .then((r: any) => {
                if (r) {
                    r.forEach((r: any) => {
                        if (typeof r.modelOptions === 'string') {
                            r.modelOptions = JSON.parse(r.modelOptions);
                        }
                        const schema = new ConduitSchema(r.name, r.fields, r.modelOptions);
                        this._schemas[r.name] = this._adapter.createSchemaFromAdapter(schema);
                    })
                }

            })
            .catch((err: Error) => {
                console.error("Something went wrong when loading schema for cms");
                console.error(err);
            })
    }

    get routes() {
        return this._routes;
    }

    get url(): string {
        return this._url;
    }

    createSchema(schema: ConduitSchema): void {
        this._schemas[schema.name] = this._adapter.createSchemaFromAdapter(schema);
    }
}



