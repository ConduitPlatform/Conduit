import schema from './models/schema';
import {AdminHandlers} from './admin/admin';
import {isNil} from 'lodash';
import ConduitGrpcSdk, { ConduitSchema, grpcModule } from '@conduit/grpc-sdk';
import path from "path";
let protoLoader = require('@grpc/proto-loader');

export class CMS {

    private _adapter: any;
    // @ts-ignore
    private _admin: AdminHandlers;
    private _schemas: { [name: string]: any } = {}; // used to be SchemaAdapter
    private readonly _router: any;
    private _url: string;
    private readonly grpcServer: any;

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
        console.log("bound on:", this._url);
        this.grpcServer.start();

        this.ensureDatabase().then(() => {
            this._adapter = this.grpcSdk.databaseProvider;
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
                        this.constructSchemaRoutes(this._schemas[r.name]);
                    })
                }

            })
            .catch((err: Error) => {
                console.error("Something went wrong when loading schema for cms");
                console.error(err);
            })
    }

    get url(): string {
        return this._url;
    }

    createSchema(schema: ConduitSchema): void {
        this._schemas[schema.name] = this._adapter.createSchemaFromAdapter(schema);
        this.constructSchemaRoutes(this._schemas[schema.name]);
    }

    //todo add support for filtering
    constructSchemaRoutes(schema: any) { // used to be SchemaAdapter
        // this.sdk.getAdmin().registerRoute('GET', '/cms/content/' + schema.originalSchema.name,
        //     (req, res, next) => {
        //         schema.findMany({})
        //             .then(r => {
        //                 res.json(r);
        //             })
        //             .catch(err => {
        //                 res.send(err);
        //             });
        //     })
        // this.sdk.getAdmin().registerRoute('GET', '/cms/content/' + schema.originalSchema.name + '/:id',
        //     (req, res, next) => {
        //         schema.findOne({id: req.params.id})
        //             .then(r => {
        //                 res.json(r);
        //             })
        //             .catch(err => {
        //                 res.send(err);
        //             });
        //     })
        // this.sdk.getRouter().registerRoute(new ConduitRoute(
        //     {
        //         path: '/content/' + schema.originalSchema.name,
        //         action: Actions.GET,
        //         queryParams: {
        //             // this is string cause Number still throws an error in graphql as unknown type number
        //             skip: TYPE.String,
        //             limit: TYPE.String
        //         }
        //     },
        //     new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
        //     async (params: ConduitRouteParameters) => {
        //         const {skip, limit} = params.params as any;
        //         let skipNumber = 0, limitNumber = 25;
        //
        //         if (!isNil(skip)) {
        //             skipNumber = Number.parseInt(skip as string);
        //         }
        //         if (!isNil(limit)) {
        //             limitNumber = Number.parseInt(limit as string);
        //         }
        //         const schemasPromise = schema.findPaginated({}, skipNumber, limitNumber);
        //         const documentCountPromise = schema.countDocuments({});
        //
        //         let err: any = null;
        //         const [schemas, documentCount] = await Promise.all([schemasPromise, documentCountPromise]).catch(e => err = e);
        //         if (!isNil(err)) throw new ConduitError('Database error', 500, err.message);
        //
        //         return {schemas, documentCount};
        //     }));

        // this.sdk.getRouter().registerRoute(new ConduitRoute(
        //     {
        //         path: '/content/' + schema.originalSchema.name,
        //         action: Actions.POST,
        //         bodyParams: schema.originalSchema.fields
        //     },
        //     new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
        //     async (params: ConduitRouteParameters) => {
        //         let body = params.params;
        //         let context = params.context;
        //         // the following line is a temporary solution
        //         const latestSchema = this._adapter.getSchema(schema.originalSchema.name);
        //         let err: any = null;
        //         const createdSchema = await latestSchema.create({...body, ...context}).catch(e => err = e);
        //         if (!isNil(err)) throw new ConduitError('Database error', 500, err.message);
        //         return createdSchema;
        //     }));
        // // todo PUT should be identical to POST but all fields should be made optional
        // // this.sdk.getRouter().registerRoute(new ConduitRoute(
        // //     {
        // //         path: '/content/' + schema.originalSchema.name,
        // //         action: Actions.POST,
        // //         bodyParams: schema.originalSchema.fields
        // //     },
        // //     new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
        // //     (params: ConduitRouteParameters) => {
        // //         let body = params.params;
        // //         let context = params.context;
        // //         // todo check if this is correct. Context was added here in case the create method needs the user for example
        // //         return schema.create({body, ...context});
        // //     }));


    }

    private async ensureDatabase(): Promise<any> {
        if (!this.grpcSdk.databaseProvider) {
            await this.grpcSdk.refreshModules(true);
            return this.ensureDatabase();
        }
    }
}



