import schema from './interfaces/schema';
import {
    ConduitRoute,
    ConduitRouteActions as Actions,
    ConduitRouteParameters,
    ConduitRouteReturnDefinition,
    ConduitSchema,
    ConduitSDK,
    IConduitCMS,
    IConduitDatabase,
    SchemaAdapter, TYPE
} from '@conduit/sdk';
import { AdminHandlers } from './handlers/admin';
import { isNil } from 'lodash';

export class CMS extends IConduitCMS {

    private readonly _adapter: IConduitDatabase;
    private readonly _schemas: { [name: string]: SchemaAdapter };
    private readonly _router: any;
    private readonly sdk: ConduitSDK;


    constructor(conduit: ConduitSDK) {
        super(conduit);
        this._schemas = {};
        this.sdk = conduit;
        this._adapter = this.sdk.getDatabase();
        this._schemas['SchemaDefinitions'] = this._adapter.createSchemaFromAdapter(schema);
        this.loadExistingSchemas();
        this.constructAdminRoutes();
    }

    private loadExistingSchemas() {
        this._adapter.getSchema('SchemaDefinitions')
            .findMany({enabled: true})
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

    createSchema(schema: ConduitSchema): void {
        this._schemas[schema.name] = this._adapter.createSchemaFromAdapter(schema);
        this.constructSchemaRoutes(this._schemas[schema.name]);
    }

    //todo add support for filtering
    constructSchemaRoutes(schema: SchemaAdapter) {
        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/content/' + schema.originalSchema.name,
                action: Actions.GET,
                queryParams: {
                    // this is string cause Number still throws an error in graphql as unknown type number
                    skip: TYPE.String,
                    limit: TYPE.String
                }
            },
            new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
            async (params: ConduitRouteParameters) => {
                const { skip, limit } = params.params as any;
                let skipNumber = 0, limitNumber = 25;

                if (!isNil(skip)) {
                    skipNumber = Number.parseInt(skip as string);
                }
                if (!isNil(limit)) {
                    limitNumber = Number.parseInt(limit as string);
                }
                const schemas = await schema.findPaginated({}, skipNumber, limitNumber);
                const documentCount = await schema.countDocuments({});

                return {schemas, documentCount};
            }));

        this.sdk.getRouter().registerRoute(new ConduitRoute(
            {
                path: '/content/' + schema.originalSchema.name,
                action: Actions.POST,
                bodyParams: schema.originalSchema.fields
            },
            new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
            (params: ConduitRouteParameters) => {
                let body = params.params;
                let context = params.context;
                return schema.create({...body, ...context});
            }));
        // todo PUT should be identical to POST but all fields should be made optional
        // this.sdk.getRouter().registerRoute(new ConduitRoute(
        //     {
        //         path: '/content/' + schema.originalSchema.name,
        //         action: Actions.POST,
        //         bodyParams: schema.originalSchema.fields
        //     },
        //     new ConduitRouteReturnDefinition(schema.originalSchema.name, schema.originalSchema.fields),
        //     (params: ConduitRouteParameters) => {
        //         let body = params.params;
        //         let context = params.context;
        //         // todo check if this is correct. Context was added here in case the create method needs the user for example
        //         return schema.create({body, ...context});
        //     }));


    }

    constructAdminRoutes() {
        const adminHandlers = new AdminHandlers(this.sdk, this, this.createSchema);

        this.sdk.getAdmin().registerRoute('GET', '/cms/schemas',
          (req, res, next) => adminHandlers.getAllSchemas(req, res).catch(next));

        this.sdk.getAdmin().registerRoute('GET', '/cms/schemas/:id',
          (req, res, next) => adminHandlers.getById(req, res).catch(next));

        this.sdk.getAdmin().registerRoute('POST', '/cms/schemas',
          (req, res, next) => adminHandlers.createSchema(req, res).catch(next));

        this.sdk.getAdmin().registerRoute('PUT', '/cms/schemas/enable/:id',
          (req, res, next) => adminHandlers.setEnable(req, res).catch(next));

        this.sdk.getAdmin().registerRoute('PUT', '/cms/schemas/:id',
          (req, res, next) => adminHandlers.editSchema(req, res).catch(next));

        this.sdk.getAdmin().registerRoute('DELETE', '/cms/schemas/:id',
          (req, res, next) => adminHandlers.deleteSchema(req, res).catch(next));

    }
}



